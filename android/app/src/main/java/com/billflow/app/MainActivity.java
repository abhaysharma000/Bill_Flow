package com.billflow.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        bridge.getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void saveBase64File(String base64Data, String mimeType, String fileName) {
                try {
                    byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                    File file = null;

                    // 1. Try public Downloads folder
                    try {
                        File pubDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!pubDownloads.exists()) {
                            pubDownloads.mkdirs();
                        }
                        file = new File(pubDownloads, fileName);
                        FileOutputStream fos = new FileOutputStream(file);
                        fos.write(fileBytes);
                        fos.flush();
                        fos.close();
                    } catch (Exception e) {
                        // Fallback to app external storage
                        File fallbackDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (fallbackDir == null) {
                            fallbackDir = getCacheDir();
                        }
                        file = new File(fallbackDir, fileName);
                        FileOutputStream fos = new FileOutputStream(file);
                        fos.write(fileBytes);
                        fos.flush();
                        fos.close();
                    }

                    final File savedFile = file;
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Saved: " + fileName, Toast.LENGTH_SHORT).show();
                    });

                    if (savedFile != null && savedFile.exists()) {
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        Uri fileUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", savedFile);
                        intent.setDataAndType(fileUri, mimeType);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        MainActivity.this.startActivity(Intent.createChooser(intent, "Open " + fileName));
                    }
                } catch (Exception e) {
                    final String err = e.getMessage();
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Error saving file: " + err, Toast.LENGTH_SHORT).show();
                    });
                }
            }

            @JavascriptInterface
            public void shareBase64File(String base64Data, String mimeType, String fileName, String subject, String text) {
                try {
                    byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                    File cacheDir = getCacheDir();
                    File file = new File(cacheDir, fileName);
                    FileOutputStream fos = new FileOutputStream(file);
                    fos.write(fileBytes);
                    fos.flush();
                    fos.close();

                    Uri fileUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                    Intent sendIntent = new Intent(Intent.ACTION_SEND);
                    sendIntent.setType(mimeType != null ? mimeType : "application/pdf");
                    sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                    if (subject != null && !subject.isEmpty()) {
                        sendIntent.putExtra(Intent.EXTRA_SUBJECT, subject);
                    }
                    if (text != null && !text.isEmpty()) {
                        sendIntent.putExtra(Intent.EXTRA_TEXT, text);
                    }
                    sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                    Intent chooser = Intent.createChooser(sendIntent, "Send " + fileName + " via");
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    MainActivity.this.startActivity(chooser);
                } catch (Exception e) {
                    final String err = e.getMessage();
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Error sharing file: " + err, Toast.LENGTH_SHORT).show();
                    });
                }
            }
        }, "NativeDownloader");
    }
}
