#Won't build without it
mkdir platforms;

#Install Plugins
phonegap local plugin add https://git-wip-us.apache.org/repos/asf/cordova-plugin-file.git;

#Build the App
phonegap run ios