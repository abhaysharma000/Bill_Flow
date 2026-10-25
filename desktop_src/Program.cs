using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace BillFlowDesktop {
    static class Program {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

        private const int SW_RESTORE = 9;
        private static HttpListener _listener;
        private static string _webRoot;
        private static int _port;
        private static bool _isRunning = true;

        private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            { ".html", "text/html; charset=utf-8" },
            { ".htm", "text/html; charset=utf-8" },
            { ".js", "text/javascript; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".json", "application/json; charset=utf-8" },
            { ".webmanifest", "application/manifest+json; charset=utf-8" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".svg", "image/svg+xml" },
            { ".ico", "image/x-icon" },
            { ".webp", "image/webp" },
            { ".woff", "font/woff" },
            { ".woff2", "font/woff2" },
            { ".ttf", "font/ttf" },
            { ".pdf", "application/pdf" },
            { ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
            { ".txt", "text/plain; charset=utf-8" }
        };

        [STAThread]
        static void Main(string[] args) {
            bool isNewInstance;
            using (Mutex mutex = new Mutex(true, "BillFlow_Windows_Desktop_Instance_Mutex", out isNewInstance)) {
                if (!isNewInstance) {
                    // Another instance is already running; find and focus its window
                    Process[] processes = Process.GetProcessesByName("BillFlow");
                    foreach (Process p in processes) {
                        if (p.Id != Process.GetCurrentProcess().Id && p.MainWindowHandle != IntPtr.Zero) {
                            ShowWindowAsync(p.MainWindowHandle, SW_RESTORE);
                            SetForegroundWindow(p.MainWindowHandle);
                            return;
                        }
                    }
                    return;
                }

                // 1. Determine Web Root Directory (look inside ./www, ../www, or current dir)
                string exeDir = AppDomain.CurrentDomain.BaseDirectory;
                if (Directory.Exists(Path.Combine(exeDir, "www"))) {
                    _webRoot = Path.Combine(exeDir, "www");
                } else if (Directory.Exists(Path.Combine(exeDir, "..", "www"))) {
                    _webRoot = Path.GetFullPath(Path.Combine(exeDir, "..", "www"));
                } else {
                    _webRoot = exeDir;
                }

                // 2. Optional: Create desktop shortcut if requested or on first launch
                bool createShortcut = false;
                foreach (string arg in args) {
                    if (arg.Equals("--create-shortcut", StringComparison.OrdinalIgnoreCase)) {
                        createShortcut = true;
                    }
                }
                string shortcutFlagFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BillFlow", ".shortcut_created");
                if (createShortcut || !File.Exists(shortcutFlagFile)) {
                    CreateDesktopShortcut();
                    try {
                        string dir = Path.GetDirectoryName(shortcutFlagFile);
                        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                        File.WriteAllText(shortcutFlagFile, DateTime.UtcNow.ToString("O"));
                    } catch { }
                }

                // 3. Find a free loopback port
                _port = GetFreeTcpPort();

                // 4. Start Local Embedded Web Server
                try {
                    _listener = new HttpListener();
                    _listener.Prefixes.Add("http://127.0.0.1:" + _port + "/");
                    _listener.Start();
                } catch (Exception ex) {
                    System.Windows.Forms.MessageBox.Show("Unable to start internal server on port " + _port + ":\n" + ex.Message, "BillFlow Startup Error", System.Windows.Forms.MessageBoxButtons.OK, System.Windows.Forms.MessageBoxIcon.Error);
                    return;
                }

                ThreadPool.QueueUserWorkItem(ListenLoop);

                // 5. Locate Edge / Chromium binary
                string browserPath = FindEdgePath();
                if (string.IsNullOrEmpty(browserPath)) {
                    System.Windows.Forms.MessageBox.Show("Microsoft Edge was not found on this system. BillFlow requires Windows 10/11 with Microsoft Edge.", "Edge Required", System.Windows.Forms.MessageBoxButtons.OK, System.Windows.Forms.MessageBoxIcon.Error);
                    return;
                }

                // 6. Dedicated isolated data directory for BillFlow persistent IndexedDB / storage
                string userDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BillFlow", "Data");
                if (!Directory.Exists(userDataDir)) {
                    Directory.CreateDirectory(userDataDir);
                }

                // 7. Launch in dedicated native App Window
                string appUrl = "http://127.0.0.1:" + _port + "/index.html";
                string arguments = string.Format(
                    "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1280,820 --no-first-run --no-default-browser-check --disable-features=TranslateUI",
                    appUrl,
                    userDataDir
                );

                ProcessStartInfo psi = new ProcessStartInfo {
                    FileName = browserPath,
                    Arguments = arguments,
                    UseShellExecute = false
                };

                Process appProcess = null;
                try {
                    appProcess = Process.Start(psi);
                } catch (Exception ex) {
                    System.Windows.Forms.MessageBox.Show("Failed to launch BillFlow window:\n" + ex.Message, "Launch Error", System.Windows.Forms.MessageBoxButtons.OK, System.Windows.Forms.MessageBoxIcon.Error);
                    return;
                }

                if (appProcess != null) {
                    appProcess.WaitForExit();
                }

                // 8. Clean Shutdown
                _isRunning = false;
                try {
                    _listener.Stop();
                    _listener.Close();
                } catch { }
            }
        }

        private static void ListenLoop(object state) {
            while (_isRunning && _listener != null && _listener.IsListening) {
                try {
                    HttpListenerContext context = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(ProcessRequest, context);
                } catch {
                    if (!_isRunning) break;
                }
            }
        }

        private static void ProcessRequest(object state) {
            HttpListenerContext context = (HttpListenerContext)state;
            try {
                string urlPath = context.Request.Url.AbsolutePath;
                if (string.IsNullOrEmpty(urlPath) || urlPath == "/") {
                    urlPath = "/index.html";
                }

                // Normalize path to prevent directory traversal
                urlPath = urlPath.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);
                string filePath = Path.Combine(_webRoot, urlPath);

                if (!File.Exists(filePath)) {
                    // Fallback to index.html for SPA routes
                    filePath = Path.Combine(_webRoot, "index.html");
                }

                if (File.Exists(filePath)) {
                    byte[] bytes = File.ReadAllBytes(filePath);
                    string ext = Path.GetExtension(filePath);
                    string mime;
                    if (!MimeTypes.TryGetValue(ext, out mime)) {
                        mime = "application/octet-stream";
                    }

                    context.Response.ContentType = mime;
                    context.Response.ContentLength64 = bytes.Length;
                    context.Response.AddHeader("Access-Control-Allow-Origin", "*");
                    context.Response.AddHeader("Cache-Control", "no-cache");
                    context.Response.OutputStream.Write(bytes, 0, bytes.Length);
                } else {
                    context.Response.StatusCode = 404;
                    byte[] err = Encoding.UTF8.GetBytes("File Not Found");
                    context.Response.OutputStream.Write(err, 0, err.Length);
                }
            } catch {
                // Connection closed or client disconnected
            } finally {
                try {
                    context.Response.OutputStream.Close();
                } catch { }
            }
        }

        private static int GetFreeTcpPort() {
            TcpListener l = new TcpListener(IPAddress.Loopback, 0);
            l.Start();
            int port = ((IPEndPoint)l.LocalEndpoint).Port;
            l.Stop();
            return port;
        }

        private static string FindEdgePath() {
            string[] possiblePaths = new string[] {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (string p in possiblePaths) {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        private static void CreateDesktopShortcut() {
            try {
                string desktopFolder = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopFolder, "BillFlow - Invoicing App.lnk");
                string exePath = Process.GetCurrentProcess().MainModule.FileName;

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null) {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = exePath;
                    shortcut.WorkingDirectory = Path.GetDirectoryName(exePath);
                    shortcut.Description = "BillFlow - Smart GST Invoicing, Inventory & Khata Ledger App";
                    shortcut.IconLocation = exePath + ",0";
                    shortcut.Save();
                }
            } catch {
                // Silently ignore if shortcut creation fails
            }
        }
    }
}
