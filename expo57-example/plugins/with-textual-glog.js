const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// NitroModules 0.37.0 exposes React's renderer headers in its modulemap, and they
// reach `<glog/logging.h>` through `RawValue.h`. glog 0.3.5 includes headers from
// inside `namespace google`, which is illegal once glog is imported as a module, so
// every target that builds the NitroModules module fails to compile. Same class of
// breakage as mrousavy/nitro#1520, which fixed only the `cxxreact` half of it in
// 0.37.0. Nothing in React Native `@import`s glog, so drop its modulemap and let
// every target include it textually. Remove once Nitro keeps React's renderer
// headers out of its public modulemap.
const HOOK = `
    Dir.glob(File.join(__dir__, 'Pods', 'Target Support Files', '*', '*.xcconfig')).each do |xcconfig|
      contents = File.read(xcconfig)
      patched = contents.gsub(
        /\\s*(-Xcc\\s+)?-fmodule-map-file="\\$\\{PODS_ROOT\\}\\/Headers\\/Public\\/glog\\/glog\\.modulemap"/, ''
      )
      File.write(xcconfig, patched) if patched != contents
    end
`;

module.exports = function withTextualGlog(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes('glog.modulemap')) return cfg;

      const anchor = 'post_install do |installer|';
      if (!contents.includes(anchor)) {
        throw new Error(
          'with-textual-glog: no post_install hook in the Podfile'
        );
      }
      fs.writeFileSync(podfile, contents.replace(anchor, anchor + '\n' + HOOK));
      return cfg;
    },
  ]);
};
