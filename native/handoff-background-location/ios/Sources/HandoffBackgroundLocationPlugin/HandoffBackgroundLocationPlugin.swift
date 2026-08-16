import Foundation
import Capacitor
import CoreLocation
import UIKit

@objc(HandoffBackgroundLocationPlugin)
public class HandoffBackgroundLocationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HandoffBackgroundLocationPlugin"
    public let jsName = "HandoffBackgroundLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startHandoffTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopHandoffTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTrackingState", returnType: CAPPluginReturnPromise)
    ]

    private var pendingStartCall: CAPPluginCall?

    @objc func startHandoffTracking(_ call: CAPPluginCall) {
        guard let claimId = call.getString("claimId")?.lowercased(),
              let accessToken = call.getString("accessToken"),
              let supabaseUrl = call.getString("supabaseUrl"),
              let publishableKey = call.getString("publishableKey"),
              let edgeFunctionUrl = call.getString("edgeFunctionUrl") else {
            call.resolve(["started": false, "reason": "invalid_claim"])
            return
        }

        let expiresAtEpochMs = call.getDouble("expiresAtEpochMs") ?? 0
        let expiresAt = Date(timeIntervalSince1970: expiresAtEpochMs / 1000.0)
        if expiresAt.timeIntervalSinceNow <= 0 {
            call.resolve(["started": false, "reason": "expired"])
            return
        }

        let tracker = HandoffLocationTracker.shared
        tracker.plugin = self
        print("[switch-it:handoff-live] nativePluginStart() claimId=\(claimId) auth=\(Self.authLabel(tracker.authorizationStatus()))")

        let status = tracker.authorizationStatus()
        switch status {
        case .denied, .restricted:
            call.resolve(["started": false, "reason": "permission_denied"])
        case .notDetermined:
            pendingStartCall = call
            tracker.prepare(
                claimId: claimId,
                expiresAt: expiresAt,
                accessToken: accessToken,
                supabaseUrl: supabaseUrl,
                publishableKey: publishableKey,
                edgeFunctionUrl: edgeFunctionUrl
            )
            tracker.requestWhenInUseAuthorization()
        default:
            let started = tracker.start(
                claimId: claimId,
                expiresAt: expiresAt,
                accessToken: accessToken,
                supabaseUrl: supabaseUrl,
                publishableKey: publishableKey,
                edgeFunctionUrl: edgeFunctionUrl
            )
            if started == "already_running" || started == nil {
                if status == .authorizedWhenInUse {
                    tracker.requestAlwaysAuthorization()
                }
                call.resolve(["started": true])
            } else if started == "permission_denied" {
                call.resolve(["started": false, "reason": "permission_denied"])
            } else {
                call.resolve(["started": false, "reason": started ?? "unavailable"])
            }
        }
    }

    @objc func stopHandoffTracking(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "stop"
        HandoffLocationTracker.shared.stop(reason: reason, notifyPublisher: true)
        call.resolve()
    }

    @objc func getTrackingState(_ call: CAPPluginCall) {
        let state = HandoffLocationTracker.shared.state()
        call.resolve([
            "active": state.active,
            "claimId": state.claimId as Any
        ])
    }

    func emitUiState(_ uiState: String) {
        notifyListeners("handoffLocationState", data: ["uiState": uiState])
    }

    static func authLabel(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorizedAlways: return "authorizedAlways"
        case .authorizedWhenInUse: return "authorizedWhenInUse"
        @unknown default: return "unknown"
        }
    }

    func authorizationDidChange(_ status: CLAuthorizationStatus) {
        guard let call = pendingStartCall else { return }
        pendingStartCall = nil

        switch status {
        case .denied, .restricted:
            call.resolve(["started": false, "reason": "permission_denied"])
        case .authorizedAlways, .authorizedWhenInUse:
            let tracker = HandoffLocationTracker.shared
            if status == .authorizedWhenInUse {
                tracker.requestAlwaysAuthorization()
            }
            let started = tracker.startPrepared()
            if started == nil || started == "already_running" {
                call.resolve(["started": true])
            } else {
                call.resolve(["started": false, "reason": started ?? "unavailable"])
            }
        default:
            break
        }
    }
}

final class HandoffLocationTracker: NSObject, CLLocationManagerDelegate {
    static let shared = HandoffLocationTracker()

    weak var plugin: HandoffBackgroundLocationPlugin?

    private let manager = CLLocationManager()
    private let lock = NSLock()

    private var claimId: String?
    private var expiresAt: Date?
    private var accessToken: String?
    private var supabaseUrl: String?
    private var publishableKey: String?
    private var edgeFunctionUrl: String?
    private var sequence = 0
    private var lastSent: (lat: Double, lng: Double, acc: Double, heading: Double?, at: Date)?
    private var expiryTimer: Timer?
    private var active = false

    private let minSendInterval: TimeInterval = 3
    private let preferredSendInterval: TimeInterval = 4
    private let heartbeatInterval: TimeInterval = 10
    private let meaningfulMoveMeters: Double = 20
    private let headingChangeDeg: Double = 35
    private let accuracyImproveMeters: Double = 25
    private let maxAccuracyMeters: Double = 150

    override init() {
        super.init()
        // CLLocationManager must be created and used on the main thread.
        if Thread.isMainThread {
            configureManager()
        } else {
            DispatchQueue.main.sync {
                self.configureManager()
            }
        }
    }

    private func configureManager() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 15
        manager.activityType = .automotiveNavigation
        manager.pausesLocationUpdatesAutomatically = false
        if #available(iOS 11.0, *) {
            manager.showsBackgroundLocationIndicator = true
        }
    }

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    func authorizationStatus() -> CLAuthorizationStatus {
        manager.authorizationStatus
    }

    func requestWhenInUseAuthorization() {
        manager.requestWhenInUseAuthorization()
    }

    func requestAlwaysAuthorization() {
        if manager.authorizationStatus == .authorizedWhenInUse {
            manager.requestAlwaysAuthorization()
        }
    }

    func prepare(
        claimId: String,
        expiresAt: Date,
        accessToken: String,
        supabaseUrl: String,
        publishableKey: String,
        edgeFunctionUrl: String
    ) {
        lock.lock()
        defer { lock.unlock() }
        self.claimId = claimId
        self.expiresAt = expiresAt
        self.accessToken = accessToken
        self.supabaseUrl = supabaseUrl
        self.publishableKey = publishableKey
        self.edgeFunctionUrl = edgeFunctionUrl
    }

    func startPrepared() -> String? {
        lock.lock()
        let claimId = self.claimId
        let expiresAt = self.expiresAt
        let accessToken = self.accessToken
        let supabaseUrl = self.supabaseUrl
        let publishableKey = self.publishableKey
        let edgeFunctionUrl = self.edgeFunctionUrl
        lock.unlock()
        guard let claimId, let expiresAt, let accessToken, let supabaseUrl, let publishableKey, let edgeFunctionUrl else {
            return "unavailable"
        }
        return start(
            claimId: claimId,
            expiresAt: expiresAt,
            accessToken: accessToken,
            supabaseUrl: supabaseUrl,
            publishableKey: publishableKey,
            edgeFunctionUrl: edgeFunctionUrl
        )
    }

    func start(
        claimId: String,
        expiresAt: Date,
        accessToken: String,
        supabaseUrl: String,
        publishableKey: String,
        edgeFunctionUrl: String
    ) -> String? {
        let status = manager.authorizationStatus
        if status == .denied || status == .restricted {
            return "permission_denied"
        }
        if expiresAt.timeIntervalSinceNow <= 0 {
            return "expired"
        }

        lock.lock()
        if active, self.claimId == claimId {
            self.accessToken = accessToken
            self.expiresAt = expiresAt
            self.edgeFunctionUrl = edgeFunctionUrl
            self.publishableKey = publishableKey
            lock.unlock()
            scheduleExpiry(expiresAt)
            return "already_running"
        }
        if active, self.claimId != claimId {
            lock.unlock()
            stop(reason: "claim_changed", notifyPublisher: true)
            lock.lock()
        }

        self.claimId = claimId
        self.expiresAt = expiresAt
        self.accessToken = accessToken
        self.supabaseUrl = supabaseUrl
        self.publishableKey = publishableKey
        self.edgeFunctionUrl = edgeFunctionUrl
        self.sequence = 0
        self.lastSent = nil
        self.active = true
        lock.unlock()

        persistLightweightState(active: true, claimId: claimId, expiresAt: expiresAt)
        let auth = manager.authorizationStatus
        print("[switch-it:handoff-live] nativePluginStarted claimId=\(claimId) auth=\(HandoffBackgroundLocationPlugin.authLabel(auth)) desiredAccuracy=best distanceFilter=15 activityType=automotiveNavigation pausesAutomatically=false allowsBackground=\(auth == .authorizedAlways)")
        onMain {
            self.manager.allowsBackgroundLocationUpdates = (auth == .authorizedAlways)
            self.manager.startUpdatingLocation()
            if #available(iOS 9.0, *) {
                self.manager.requestLocation()
            }
            self.plugin?.emitUiState("acquiring")
        }
        scheduleExpiry(expiresAt)
        return nil
    }

    func stop(reason: String, notifyPublisher: Bool) {
        lock.lock()
        let wasActive = active
        let claimId = self.claimId
        let token = accessToken
        let url = edgeFunctionUrl
        let key = publishableKey
        let nextSequence = sequence + 1
        active = false
        sequence = 0
        lastSent = nil
        lock.unlock()

        expiryTimer?.invalidate()
        expiryTimer = nil
        onMain {
            self.manager.stopUpdatingLocation()
            self.manager.allowsBackgroundLocationUpdates = false
        }
        persistLightweightState(active: false, claimId: nil, expiresAt: nil)
        print("[switch-it:handoff-live] nativePluginStop() reason=\(reason) claimId=\(claimId ?? "none")")

        guard wasActive, notifyPublisher, let claimId, let token, let url, let key else {
            return
        }
        postEvent(
            url: url,
            token: token,
            publishableKey: key,
            claimId: claimId,
            event: "seeker-location-status",
            payload: [
                "status": "stopped",
                "sequence": nextSequence,
                "sentAt": Date().timeIntervalSince1970 * 1000
            ],
            markSharingOnSuccess: false
        )
    }

    func state() -> (active: Bool, claimId: String?) {
        lock.lock()
        defer { lock.unlock() }
        if let expiresAt, expiresAt.timeIntervalSinceNow <= 0 {
            return (false, claimId)
        }
        return (active, claimId)
    }

    private func scheduleExpiry(_ expiresAt: Date) {
        DispatchQueue.main.async {
            self.expiryTimer?.invalidate()
            let timer = Timer(fireAt: expiresAt, interval: 0, target: self, selector: #selector(self.expiryFired), userInfo: nil, repeats: false)
            RunLoop.main.add(timer, forMode: .common)
            self.expiryTimer = timer
        }
    }

    @objc private func expiryFired() {
        stop(reason: "expired", notifyPublisher: true)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        print("[switch-it:handoff-live] ios authorization=\(HandoffBackgroundLocationPlugin.authLabel(manager.authorizationStatus))")
        plugin?.authorizationDidChange(manager.authorizationStatus)
        if manager.authorizationStatus == .authorizedAlways {
            onMain {
                self.manager.allowsBackgroundLocationUpdates = true
            }
        }
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
            stop(reason: "permission_denied", notifyPublisher: true)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        plugin?.emitUiState("weak")
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        lock.lock()
        let isActive = active
        let expiresAt = self.expiresAt
        let claimId = self.claimId
        let token = accessToken
        let url = edgeFunctionUrl
        let key = publishableKey
        let previous = lastSent
        lock.unlock()

        guard isActive, let expiresAt, expiresAt.timeIntervalSinceNow > 0 else {
            stop(reason: "expired", notifyPublisher: true)
            return
        }
        guard let claimId, let token, let url, let key else { return }

        let accuracy = location.horizontalAccuracy
        let ageMs = Int((Date().timeIntervalSince(location.timestamp)) * 1000)
        if accuracy <= 0 || accuracy > maxAccuracyMeters {
            plugin?.emitUiState("weak")
            print("[switch-it:handoff-live] gps rejected provider=corelocation claimId=\(claimId) lat=\(location.coordinate.latitude) lng=\(location.coordinate.longitude) accuracy=\(accuracy) timestamp=\(location.timestamp.timeIntervalSince1970 * 1000) ageMs=\(ageMs) reason=unusable_accuracy")
            return
        }

        print("[switch-it:handoff-live] gps accepted provider=corelocation claimId=\(claimId) lat=\(location.coordinate.latitude) lng=\(location.coordinate.longitude) accuracy=\(accuracy) timestamp=\(location.timestamp.timeIntervalSince1970 * 1000) ageMs=\(ageMs) auth=\(HandoffBackgroundLocationPlugin.authLabel(manager.authorizationStatus))")

        var heading: Double? = nil
        if location.course >= 0 {
            heading = (location.course.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        }

        let now = Date()
        let appState = Self.appStateLabel()
        if !shouldSend(previous: previous, lat: location.coordinate.latitude, lng: location.coordinate.longitude, acc: accuracy, heading: heading, at: now) {
            print("[switch-it:handoff-live] gps accepted (throttled, awaiting prior transport) claimId=\(claimId) appState=\(appState)")
            return
        }

        lock.lock()
        sequence += 1
        let seq = sequence
        lastSent = (location.coordinate.latitude, location.coordinate.longitude, accuracy, heading, now)
        lock.unlock()

        var payload: [String: Any] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracyMeters": accuracy,
            "sequence": seq,
            "sentAt": now.timeIntervalSince1970 * 1000
        ]
        // Omit heading when Core Location has no course. JSON null / NSNull
        // previously broke native POST serialization.
        if let heading {
            payload["headingDegrees"] = heading
        }
        print("[switch-it:handoff-live] native post attempt claimId=\(claimId) lat=\(location.coordinate.latitude) lng=\(location.coordinate.longitude) timestamp=\(now.timeIntervalSince1970 * 1000) sequence=\(seq) appState=\(appState)")
        postEvent(
            url: url,
            token: token,
            publishableKey: key,
            claimId: claimId,
            event: "seeker-location",
            payload: payload,
            markSharingOnSuccess: true
        )
    }

    private static func appStateLabel() -> String {
        var label = "unknown"
        let read = {
            switch UIApplication.shared.applicationState {
            case .active: label = "active"
            case .inactive: label = "inactive"
            case .background: label = "background"
            @unknown default: label = "unknown"
            }
        }
        if Thread.isMainThread {
            read()
        } else {
            DispatchQueue.main.sync(execute: read)
        }
        return label
    }

    private func shouldSend(
        previous: (lat: Double, lng: Double, acc: Double, heading: Double?, at: Date)?,
        lat: Double,
        lng: Double,
        acc: Double,
        heading: Double?,
        at: Date
    ) -> Bool {
        guard let previous else { return true }
        let elapsed = at.timeIntervalSince(previous.at)
        if elapsed < minSendInterval { return false }
        let moved = haversineMeters(lat1: previous.lat, lng1: previous.lng, lat2: lat, lng2: lng)
        if elapsed >= preferredSendInterval && moved >= meaningfulMoveMeters { return true }
        if let prevH = previous.heading, let nextH = heading {
            let delta = abs(prevH - nextH).truncatingRemainder(dividingBy: 360)
            let turn = delta > 180 ? 360 - delta : delta
            if moved >= 5 && turn >= headingChangeDeg { return true }
        }
        if previous.acc - acc >= accuracyImproveMeters { return true }
        if elapsed >= heartbeatInterval { return true }
        return false
    }

    private func haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
        let r = 6_371_000.0
        let p1 = lat1 * .pi / 180
        let p2 = lat2 * .pi / 180
        let dPhi = (lat2 - lat1) * .pi / 180
        let dLambda = (lng2 - lng1) * .pi / 180
        let a = sin(dPhi / 2) * sin(dPhi / 2) +
            cos(p1) * cos(p2) * sin(dLambda / 2) * sin(dLambda / 2)
        return 2 * r * atan2(sqrt(a), sqrt(1 - a))
    }

    private func persistLightweightState(active: Bool, claimId: String?, expiresAt: Date?) {
        let defaults = UserDefaults.standard
        defaults.set(active, forKey: "switchit.handoff.active")
        defaults.set(claimId, forKey: "switchit.handoff.claimId")
        defaults.set(expiresAt?.timeIntervalSince1970, forKey: "switchit.handoff.expiresAt")
        // Access token is never written to disk.
    }

    private func postEvent(
        url: String,
        token: String,
        publishableKey: String,
        claimId: String,
        event: String,
        payload: [String: Any],
        markSharingOnSuccess: Bool
    ) {
        guard let endpoint = URL(string: url) else { return }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        print("[switch-it:handoff-live] native post attempt claimId=\(claimId) event=\(event) appState=\(Self.appStateLabel())")
        let body: [String: Any] = [
            "claimId": claimId,
            "event": event,
            "payload": payload
        ]
        guard JSONSerialization.isValidJSONObject(body),
              let httpBody = try? JSONSerialization.data(withJSONObject: body) else {
            print("[switch-it:handoff-live] native post skipped: json serialization failed claimId=\(claimId) event=\(event)")
            plugin?.emitUiState("unavailable")
            return
        }
        request.httpBody = httpBody

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error {
                print("[switch-it:handoff-live] native post status=error event=\(event) claimId=\(claimId) error=\(error.localizedDescription) appState=\(Self.appStateLabel())")
                if markSharingOnSuccess {
                    self.plugin?.emitUiState("unavailable")
                }
                return
            }
            guard let http = response as? HTTPURLResponse else {
                print("[switch-it:handoff-live] native post status=error event=\(event) claimId=\(claimId) error=no_http_response")
                if markSharingOnSuccess {
                    self.plugin?.emitUiState("unavailable")
                }
                return
            }
            print("[switch-it:handoff-live] native post status=\(http.statusCode) event=\(event) claimId=\(claimId) appState=\(Self.appStateLabel())")
            if http.statusCode == 401 || http.statusCode == 403 {
                self.stop(reason: "unauthorized", notifyPublisher: false)
                self.plugin?.emitUiState("unavailable")
                return
            }
            if (200...299).contains(http.statusCode) {
                if markSharingOnSuccess {
                    self.plugin?.emitUiState("sharing")
                }
                return
            }
            if markSharingOnSuccess {
                self.plugin?.emitUiState("unavailable")
            }
            if let data {
                let snippet = String(data: data, encoding: .utf8) ?? ""
                print("[switch-it:handoff-live] native post body claimId=\(claimId) snippet=\(snippet.prefix(200))")
            }
            // Network failures are ignored for history; UI reflects transport.
        }.resume()
    }
}
