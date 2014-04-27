TouchScript
===========

Usage
-----

Installation:
```bash
npm install
npm install ../on3/onDrag
sudo npm install -g phonegap
sudo npm install ios-sim -g
```

Make sure that you have XCode Installed.

Development
-----------

To Build: `grunt build`

Note that the first phonegap build might fail, just run `grunt build` again.

To Serve (should be used for browser debugging for file APIs):
```bash
npm install -g http-server
http-server
```

Example at: [http://localhost:8080/examples/index.html](http://localhost:8080/examples/index.html)

To Develop: `grunt watch`

To Test: `npm test`

The iOS simulator app directory is located at `/Users/[username]/Library/Application Support/iPhone Simulator/7.1`