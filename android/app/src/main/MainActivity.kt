package com.ssenterprises.abha

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val fileRequestCode = 1001
    private val permissionRequestCode = 1002

    private val appUrl =
        "https://ss-enterprises-abha-app-2026.onrender.com/"

    private fun allowedHost(host: String?): Boolean {
        val h = host?.lowercase() ?: return false

        return h == "ss-enterprises-abha-app-2026.onrender.com" ||
               h == "abha.abdm.gov.in" ||
               h.endsWith(".abdm.gov.in") ||
               h == "localhost"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        configureWebView()
        requestNeededPermissions()
        loadPortal()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {

                override fun handleOnBackPressed() {

                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        finish()
                    }
                }
            }
        )
    }

    private fun loadPortal() {

        if (isFinishing || isDestroyed) return

        try {
            webView.loadUrl(appUrl)
        } catch (_: Exception) {

            webView.postDelayed({

                if (!isFinishing && !isDestroyed) {

                    try {
                        webView.loadUrl(appUrl)
                    } catch (_: Exception) {
                    }
                }

            }, 1000)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {

        webView.settings.apply {

            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true

            allowFileAccess = true
            allowContentAccess = true

            mediaPlaybackRequiresUserGesture = false

            cacheMode = WebSettings.LOAD_DEFAULT

            mixedContentMode =
                WebSettings.MIXED_CONTENT_NEVER_ALLOW

            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            userAgentString =
                "$userAgentString SS-ENTERPRISES-ABHA-Android/4.3.2"
        }

        CookieManager.getInstance().setAcceptCookie(true)

        CookieManager.getInstance()
            .setAcceptThirdPartyCookies(webView, true)


        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {

                return handleNavigation(
                    request.url.toString()
                )
            }


            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(
                view: WebView,
                url: String
            ): Boolean {

                return handleNavigation(url)
            }


            private fun handleNavigation(
                urlString: String
            ): Boolean {

                if (urlString.isBlank()) return false

                val uri = try {

                    Uri.parse(urlString)

                } catch (_: Exception) {

                    return false
                }

                val scheme =
                    uri.scheme?.lowercase()


                /*
                 * NORMAL HTTPS / HTTP
                 */

                if (scheme == "http" || scheme == "https") {

                    /*
                     * SS Enterprises website
                     * and ABHA/ABDM website stay INSIDE app.
                     */

                    if (allowedHost(uri.host)) {
                        return false
                    }


                    /*
                     * Other websites open outside app.
                     */

                    return try {

                        startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                uri
                            )
                        )

                        true

                    } catch (_: Exception) {

                        false
                    }
                }


                /*
                 * IMPORTANT ABHA FIX
                 *
                 * ABHA website can send:
                 *
                 * intent://....
                 *
                 * WebView normally gives:
                 *
                 * ERR_UNKNOWN_URL_SCHEME
                 *
                 * So we convert the intent:// URL
                 * into an Android Intent.
                 */

                if (scheme == "intent") {

                    return openIntentUrl(urlString)
                }


                /*
                 * Other custom schemes
                 * such as abha:// etc.
                 */

                return try {

                    val intent =
                        Intent(
                            Intent.ACTION_VIEW,
                            uri
                        )

                    startActivity(intent)

                    true

                } catch (_: ActivityNotFoundException) {

                    false

                } catch (_: Exception) {

                    false
                }
            }


            private fun openIntentUrl(
                urlString: String
            ): Boolean {

                return try {

                    val intent =
                        Intent.parseUri(
                            urlString,
                            Intent.URI_INTENT_SCHEME
                        )

                    intent.addCategory(
                        Intent.CATEGORY_BROWSABLE
                    )


                    /*
                     * First try to open the target Android app.
                     */

                    try {

                        startActivity(intent)

                        true

                    } catch (_: ActivityNotFoundException) {

                        /*
                         * Target app not installed.
                         *
                         * Open Play Store using the package
                         * supplied by the intent.
                         */

                        val packageName =
                            intent.`package`


                        if (packageName.isNullOrBlank()) {

                            false

                        } else {

                            try {

                                startActivity(
                                    Intent(
                                        Intent.ACTION_VIEW,
                                        Uri.parse(
                                            "market://details?id=$packageName"
                                        )
                                    )
                                )

                            } catch (_: ActivityNotFoundException) {

                                startActivity(
                                    Intent(
                                        Intent.ACTION_VIEW,
                                        Uri.parse(
                                            "https://play.google.com/store/apps/details?id=$packageName"
                                        )
                                    )
                                )
                            }

                            true
                        }
                    }

                } catch (_: Exception) {

                    false
                }
            }


            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {

                super.onReceivedError(
                    view,
                    request,
                    error
                )
            }
        }


        /*
         * CAMERA / MICROPHONE / FILE UPLOAD
         */

        webView.webChromeClient =
            object : WebChromeClient() {

                override fun onPermissionRequest(
                    request: PermissionRequest
                ) {

                    runOnUiThread {

                        if (
                            isFinishing ||
                            isDestroyed
                        ) {

                            try {
                                request.deny()
                            } catch (_: Exception) {
                            }

                            return@runOnUiThread
                        }


                        val originHost =
                            try {

                                Uri.parse(
                                    request.origin.toString()
                                ).host

                            } catch (_: Exception) {

                                null
                            }


                        /*
                         * Only allow camera/mic
                         * from our website and ABHA/ABDM.
                         */

                        if (!allowedHost(originHost)) {

                            try {
                                request.deny()
                            } catch (_: Exception) {
                            }

                            return@runOnUiThread
                        }


                        val resources =
                            request.resources.filter {

                                (
                                    it ==
                                        PermissionRequest
                                            .RESOURCE_VIDEO_CAPTURE
                                    &&
                                    ContextCompat.checkSelfPermission(
                                        this@MainActivity,
                                        Manifest.permission.CAMERA
                                    ) ==
                                        PackageManager.PERMISSION_GRANTED
                                )

                                ||

                                (
                                    it ==
                                        PermissionRequest
                                            .RESOURCE_AUDIO_CAPTURE
                                    &&
                                    ContextCompat.checkSelfPermission(
                                        this@MainActivity,
                                        Manifest.permission.RECORD_AUDIO
                                    ) ==
                                        PackageManager.PERMISSION_GRANTED
                                )

                            }.toTypedArray()


                        try {

                            if (
                                resources.isNotEmpty()
                            ) {

                                request.grant(
                                    resources
                                )

                            } else {

                                request.deny()
                            }

                        } catch (_: Exception) {

                            try {
                                request.deny()
                            } catch (_: Exception) {
                            }
                        }
                    }
                }


                /*
                 * Gallery / File upload
                 */

                override fun onShowFileChooser(
                    webView: WebView?,
                    callback:
                        ValueCallback<Array<Uri>>?,
                    params:
                        FileChooserParams?
                ): Boolean {

                    fileCallback
                        ?.onReceiveValue(null)

                    fileCallback = callback


                    val intent =
                        try {

                            params?.createIntent()

                        } catch (_: Exception) {

                            null
                        }
                        ?: Intent(
                            Intent.ACTION_GET_CONTENT
                        ).apply {

                            type = "*/*"

                            addCategory(
                                Intent.CATEGORY_OPENABLE
                            )
                        }


                    return try {

                        startActivityForResult(
                            intent,
                            fileRequestCode
                        )

                        true

                    } catch (_: Exception) {

                        fileCallback
                            ?.onReceiveValue(null)

                        fileCallback = null

                        false
                    }
                }
            }
    }


    private fun requestNeededPermissions() {

        val permissions =
            arrayOf(

                Manifest.permission.CAMERA,

                Manifest.permission.RECORD_AUDIO,

                Manifest.permission.ACCESS_FINE_LOCATION,

                Manifest.permission.ACCESS_COARSE_LOCATION
            )


        val needed =
            permissions.filter {

                ContextCompat.checkSelfPermission(
                    this,
                    it
                ) !=
                    PackageManager.PERMISSION_GRANTED
            }


        if (needed.isNotEmpty()) {

            ActivityCompat.requestPermissions(

                this,

                needed.toTypedArray(),

                permissionRequestCode
            )
        }
    }


    @Deprecated(
        "Deprecated on newer Android versions; retained for compatibility"
    )
    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {

        super.onActivityResult(
            requestCode,
            resultCode,
            data
        )


        if (
            requestCode ==
                fileRequestCode
        ) {

            val results =

                if (
                    resultCode ==
                        Activity.RESULT_OK &&
                    data != null
                ) {

                    WebChromeClient
                        .FileChooserParams
                        .parseResult(
                            resultCode,
                            data
                        )

                } else {

                    null
                }


            fileCallback
                ?.onReceiveValue(results)

            fileCallback = null
        }
    }


    override fun onDestroy() {

        fileCallback
            ?.onReceiveValue(null)

        fileCallback = null


        try {

            webView.stopLoading()

            webView.webChromeClient = null

            webView.webViewClient = null

            webView.destroy()

        } catch (_: Exception) {
        }


        super.onDestroy()
    }
}
