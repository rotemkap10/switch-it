Pod::Spec.new do |s|
  s.name = 'SwitchItHandoffBackgroundLocation'
  s.version = '0.1.0'
  s.summary = 'Switch It background handoff location'
  s.license = 'UNLICENSED'
  s.homepage = 'https://github.com/switch-it'
  s.author = 'Switch It'
  s.source = { :git => 'https://github.com/switch-it', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
