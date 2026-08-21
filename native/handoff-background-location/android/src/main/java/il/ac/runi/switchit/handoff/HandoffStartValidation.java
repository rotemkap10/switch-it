package il.ac.runi.switchit.handoff;

/**
 * Pure start-parameter validation for Android handoff tracking.
 * Kept free of Android framework types so contract rules stay testable.
 *
 * Capacitor Android stores large JS numbers (epoch ms) as {@link Long}.
 * {@code PluginCall.getDouble} does not accept Long and returns null — that
 * previously collapsed into a misleading {@code invalid_claim} failure.
 */
public final class HandoffStartValidation {

    private HandoffStartValidation() {}

    public static final String REASON_INVALID_CLAIM_ID = "invalid_claim_id";
    public static final String REASON_INVALID_EXPIRY = "invalid_expiry";
    public static final String REASON_EXPIRED = "expired";
    public static final String REASON_MISSING_ACCESS_TOKEN = "missing_access_token";
    public static final String REASON_INVALID_SUPABASE_URL = "invalid_supabase_url";
    public static final String REASON_MISSING_PUBLISHABLE_KEY = "missing_publishable_key";
    public static final String REASON_INVALID_EDGE_FUNCTION_URL = "invalid_edge_function_url";

    /**
     * Reads epoch milliseconds from a Capacitor/JSON bridge value.
     * Accepts Long (typical for epoch ms), Integer, Double, Float, and Number.
     */
    public static Long readEpochMs(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Long) {
            return (Long) value;
        }
        if (value instanceof Integer) {
            return ((Integer) value).longValue();
        }
        if (value instanceof Double) {
            double d = (Double) value;
            if (Double.isNaN(d) || Double.isInfinite(d)) {
                return null;
            }
            return (long) d;
        }
        if (value instanceof Float) {
            float f = (Float) value;
            if (Float.isNaN(f) || Float.isInfinite(f)) {
                return null;
            }
            return (long) f;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            String trimmed = ((String) value).trim();
            if (trimmed.isEmpty()) {
                return null;
            }
            try {
                return Long.parseLong(trimmed);
            } catch (NumberFormatException ignored) {
                try {
                    double d = Double.parseDouble(trimmed);
                    if (Double.isNaN(d) || Double.isInfinite(d)) {
                        return null;
                    }
                    return (long) d;
                } catch (NumberFormatException ignoredAgain) {
                    return null;
                }
            }
        }
        return null;
    }

    public static boolean isNonBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    /** UUID shape only — does not contact the backend. */
    public static boolean isUuidShaped(String claimId) {
        if (!isNonBlank(claimId)) {
            return false;
        }
        String normalized = claimId.trim().toLowerCase();
        return normalized.matches(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        );
    }

    public static boolean isHttpsUrl(String url) {
        if (!isNonBlank(url)) {
            return false;
        }
        String trimmed = url.trim().toLowerCase();
        return trimmed.startsWith("https://") && trimmed.length() > "https://".length();
    }

    /**
     * Accept modern {@code sb_publishable_...} keys and legacy JWT-shaped anon keys.
     * Does not cryptographically validate; backend auth remains authoritative.
     */
    public static boolean isAcceptablePublishableKey(String key) {
        if (!isNonBlank(key)) {
            return false;
        }
        String trimmed = key.trim();
        if (trimmed.startsWith("sb_publishable_")) {
            return trimmed.length() > "sb_publishable_".length();
        }
        // Legacy Supabase anon JWT.
        return trimmed.startsWith("eyJ") && trimmed.length() > 20;
    }

    public static final class ValidationResult {
        public final boolean ok;
        public final String reason;
        public final boolean claimIdValid;
        public final boolean expiresPresent;
        public final Long expiresDeltaMs;
        public final boolean accessTokenPresent;
        public final boolean supabaseUrlValid;
        public final boolean publishableKeyPresent;
        public final boolean edgeFunctionUrlValid;

        ValidationResult(
            boolean ok,
            String reason,
            boolean claimIdValid,
            boolean expiresPresent,
            Long expiresDeltaMs,
            boolean accessTokenPresent,
            boolean supabaseUrlValid,
            boolean publishableKeyPresent,
            boolean edgeFunctionUrlValid
        ) {
            this.ok = ok;
            this.reason = reason;
            this.claimIdValid = claimIdValid;
            this.expiresPresent = expiresPresent;
            this.expiresDeltaMs = expiresDeltaMs;
            this.accessTokenPresent = accessTokenPresent;
            this.supabaseUrlValid = supabaseUrlValid;
            this.publishableKeyPresent = publishableKeyPresent;
            this.edgeFunctionUrlValid = edgeFunctionUrlValid;
        }
    }

    public static ValidationResult validate(
        String claimId,
        Long expiresAtEpochMs,
        String accessToken,
        String supabaseUrl,
        String publishableKey,
        String edgeFunctionUrl,
        long nowMs
    ) {
        boolean claimIdValid = isUuidShaped(claimId);
        boolean expiresPresent = expiresAtEpochMs != null;
        Long expiresDeltaMs = expiresPresent ? expiresAtEpochMs - nowMs : null;
        boolean accessTokenPresent = isNonBlank(accessToken);
        boolean supabaseUrlValid = isHttpsUrl(supabaseUrl);
        boolean publishableKeyPresent = isAcceptablePublishableKey(publishableKey);
        boolean edgeFunctionUrlValid = isHttpsUrl(edgeFunctionUrl);

        if (!claimIdValid) {
            return fail(
                REASON_INVALID_CLAIM_ID,
                claimIdValid,
                expiresPresent,
                expiresDeltaMs,
                accessTokenPresent,
                supabaseUrlValid,
                publishableKeyPresent,
                edgeFunctionUrlValid
            );
        }
        if (!expiresPresent) {
            return fail(
                REASON_INVALID_EXPIRY,
                claimIdValid,
                expiresPresent,
                expiresDeltaMs,
                accessTokenPresent,
                supabaseUrlValid,
                publishableKeyPresent,
                edgeFunctionUrlValid
            );
        }
        if (expiresAtEpochMs <= nowMs) {
            return fail(
                REASON_EXPIRED,
                claimIdValid,
                expiresPresent,
                expiresDeltaMs,
                accessTokenPresent,
                supabaseUrlValid,
                publishableKeyPresent,
                edgeFunctionUrlValid
            );
        }
        if (!accessTokenPresent) {
            return fail(
                REASON_MISSING_ACCESS_TOKEN,
                claimIdValid,
                expiresPresent,
                expiresDeltaMs,
                accessTokenPresent,
                supabaseUrlValid,
                publishableKeyPresent,
                edgeFunctionUrlValid
            );
        }
        if (!supabaseUrlValid) {
            return fail(
                REASON_INVALID_SUPABASE_URL,
                claimIdValid,
                expiresPresent,
                expiresDeltaMs,
                accessTokenPresent,
                supabaseUrlValid,
                publishableKeyPresent,
                edgeFunctionUrlValid
            );
        }
        if (!publishableKeyPresent) {
            return fail(
                REASON_MISSING_PUBLISHABLE_KEY,
                claimIdValid,
                expiresPresent,
                expiresDeltaMs,
                accessTokenPresent,
                supabaseUrlValid,
                publishableKeyPresent,
                edgeFunctionUrlValid
            );
        }
        if (!edgeFunctionUrlValid) {
            return fail(
                REASON_INVALID_EDGE_FUNCTION_URL,
                claimIdValid,
                expiresPresent,
                expiresDeltaMs,
                accessTokenPresent,
                supabaseUrlValid,
                publishableKeyPresent,
                edgeFunctionUrlValid
            );
        }

        return new ValidationResult(
            true,
            null,
            claimIdValid,
            expiresPresent,
            expiresDeltaMs,
            accessTokenPresent,
            supabaseUrlValid,
            publishableKeyPresent,
            edgeFunctionUrlValid
        );
    }

    private static ValidationResult fail(
        String reason,
        boolean claimIdValid,
        boolean expiresPresent,
        Long expiresDeltaMs,
        boolean accessTokenPresent,
        boolean supabaseUrlValid,
        boolean publishableKeyPresent,
        boolean edgeFunctionUrlValid
    ) {
        return new ValidationResult(
            false,
            reason,
            claimIdValid,
            expiresPresent,
            expiresDeltaMs,
            accessTokenPresent,
            supabaseUrlValid,
            publishableKeyPresent,
            edgeFunctionUrlValid
        );
    }
}
