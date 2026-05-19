# Running on macOS

Official macOS downloads are not available yet, but you can run the app
from source with a few copy-paste steps.

## Step 1: Install the tools the app needs

You need three things. If you've already installed any of them, skip
that one.

**Node.js** - Go to [nodejs.org](https://nodejs.org/), download the
LTS version, and run the installer.

**Python 3** - Go to [python.org](https://www.python.org/downloads/),
download the latest Python 3, and run the installer.

**Git** - Go to [git-scm.com](https://git-scm.com/downloads/mac),
download the macOS installer, and run it.

All three are standard tools used by many apps. They install like any
other program.

## Step 2: Open Terminal

Press **Command + Space** to open Spotlight, type **Terminal**, and
press Enter.

A window with a dark background and a text cursor will appear. This is
where you'll paste the commands below. Don't worry about the
appearance - it's normal.

## Step 3: Download and run the app

Copy the block below in one go, paste it into Terminal
(**Command + V**), and press **Enter**:

```bash
git clone https://github.com/Wen387/DendryModStudio.git
cd DendryModStudio
npm ci
cd tools/project_map/desktop
npm ci
npm run fetch:python
npm run start
```

Terminal will print several lines of text while it works. Some may be
coloured - this is normal. Wait until the output stops and the app
window appears. It may take a minute or two the first time.

The app runs directly from Terminal. There won't be an icon on your
desktop or in your Dock - instead, the app window will simply open.
To close the app, close the window and then press **Ctrl + C** in
Terminal.

## Next time

To open the app again, open Terminal and paste:

```bash
cd DendryModStudio/tools/project_map/desktop
npm run start
```

## Optional: make a clickable app

If you'd rather have an app you can open from Finder without using
Terminal every time:

```bash
cd DendryModStudio/tools/project_map/desktop
npm run fetch:python
npx electron-builder --mac zip --arm64 -c.mac.identity=null
```

> **Intel Mac?** Replace `--arm64` with `--x64`.
> Not sure which you have? Click **Apple menu > About This Mac**. If it says
> "Apple M..." it's ARM; if it says "Intel" use `--x64`.

When you open the built app for the first time, macOS will block it.
Go to **System Settings > Privacy & Security**, scroll down, and
click **Open Anyway** next to the app name.

## Updating to a newer version

Open Terminal and paste:

```bash
cd DendryModStudio
git pull
npm ci
cd tools/project_map/desktop
npm ci
npm run fetch:python
npm run start
```

This downloads the latest changes and reinstalls any dependencies that
may have changed between versions. The app will open once it's done.

If you previously built a clickable app (the optional step above),
you'll need to rebuild it after updating:

```bash
cd DendryModStudio/tools/project_map/desktop
npm run fetch:python
npx electron-builder --mac zip --arm64 -c.mac.identity=null
```

> Intel Mac? Replace `--arm64` with `--x64`.

## Something not working?

If the app has a bug, please
[open an issue](https://github.com/Wen387/DendryModStudio/issues).
We don't maintain official macOS builds yet, so questions about Apple
signing or notarization are out of scope for now.
