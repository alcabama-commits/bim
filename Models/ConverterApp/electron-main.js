import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: "IFC to FRAG Converter",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Load the local server
    // We wait a bit to ensure server is ready, or retry loading
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 1500);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', () => {
    // Start the Express server as a child process
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = spawn('node', [serverPath], {
        cwd: __dirname,
        stdio: 'inherit' // Pipe output to console
    });

    createWindow();
});

app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    // Kill the server process when app quits
    if (serverProcess) {
        serverProcess.kill();
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
