package com.ssenterprises.abha

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Message
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

    private val abhaPackage =
        "in.ndhm.phr"

    private var rendererRecoveryInProgress = false

    private var intentBeingHandled = false


    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(
        savedInstanceState: Bundle?
    ) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        configureWebView()

        requestNeededPermissions()

        if (savedInstanceState == null) {
            loadPortal()
        } else {
            try {
                val restored =
                    webView.restoreState(savedInstanceState)

                if (restored == null) {
                    loadPortal()
                }
            } catch (_: Exception) {
                loadPortal()
            }
        }

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

            try {

                webView.postDelayed({

                    if (!isFinishing && !isDestroyed) {

                        try {
                            webView.loadUrl(appUrl)
                        } catch (_: Exception) {
                        }
                    }

                }, 1000)

            } catch (_: Exception) {
            }
        }
    }


    private fun isAllowedWebHost(
        host: String?
    ): Boolean {

        val h =
            host?.lowercase()
                ?: return false

        return (
            h == "ss-enterprises-abha-app-2026.onrender.com" ||
            h == "abha.abdm.gov.in" ||
            h.endsWith(".abdm.gov.in") ||
            h == "localhost"
        )
    }


    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {

        webView.settings.apply {

            javaScriptEnabled = true

            domStorageEnabled = true

            databaseEnabled = true

            mediaPlaybackRequiresUserGesture = false

            allowFileAccess = true

            allowContentAccess = true

            cacheMode =
                WebSettings.LOAD_DEFAULT

            mixedContentMode =
                WebSettings.MIXED_CONTENT_NEVER_ALLOW

            setSupportZoom(false)

            builtInZoomControls = false

            displayZoomControls = false

            /*
             * Important:
             * Keep new-window navigation inside this
             * WebView instead of creating another WebView.
             */
            setSupportMultipleWindows(false)

            userAgentString =
                "$userAgentString SS-ENTERPRISES-ABHA-Android/4.4"
        }


        CookieManager
            .getInstance()
            .setAcceptCookie(true)

        CookieManager
            .getInstance()
            .setAcceptThirdPartyCookies(
                webView,
                true
            )


        webView.webViewClient =
            object : WebViewClient() {


                /*
                 * MAIN URL INTERCEPTION
                 */
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {

                    val url =
                        request.url.toString()

                    return handleNavigation(
                        view,
                        url
                    )
                }


                /*
                 * OLD ANDROID COMPATIBILITY
                 */
                @Suppress("DEPRECATION")
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    url: String
                ): Boolean {

                    return handleNavigation(
                        view,
                        url
                    )
                }


                /*
                 * EXTRA BACKUP:
                 *
                 * Some ABHA pages navigate to intent://
                 * in a way where shouldOverrideUrlLoading()
                 * is not called.
                 *
                 * Therefore we catch it here also.
                 */
                override fun onPageStarted(
                    view: WebView,
                    url: String,
                    favicon: android.graphics.Bitmap?
                ) {

                    val lower =
                        url.trim().lowercase()

                    if (
                        lower.startsWith("intent://") ||
                        lower.startsWith("abha://") ||
                        lower.startsWith("abha:")
                    ) {

                        try {
                            view.stopLoading()
                        } catch (_: Exception) {
                        }

                        handleNavigation(
                            view,
                            url
                        )

                        return
                    }

                    super.onPageStarted(
                        view,
                        url,
                        favicon
                    )
                }


                /*
                 * MOST IMPORTANT BACKUP
                 *
                 * Your screenshot shows:
                 *
                 * net::ERR_UNKNOWN_URL_SCHEME
                 *
                 * If Android WebView reaches that error,
                 * catch the original intent URL here and
                 * launch the ABHA application.
                 */
                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {

                    val url =
                        request.url.toString()

                    if (
                        request.isForMainFrame &&
                        (
                            url.trim()
                                .lowercase()
                                .startsWith("intent://") ||
                            url.trim()
                                .lowercase()
                                .startsWith("abha://") ||
                            url.trim()
                                .lowercase()
                                .startsWith("abha:")
                        )
                    ) {

                        try {
                            view.stopLoading()
                        } catch (_: Exception) {
                        }

                        handleNavigation(
                            view,
                            url
                        )

                        return
                    }

                    super.onReceivedError(
                        view,
                        request,
                        error
                    )
                }


                override fun onRenderProcessGone(
                    view: WebView,
                    detail:
                    android.webkit.RenderProcessGoneDetail
                ): Boolean {

                    if (
                        !isFinishing &&
                        !isDestroyed &&
                        !rendererRecoveryInProgress
                    ) {

                        rendererRecoveryInProgress =
                            true

                        try {

                            view.stopLoading()

                            view.loadUrl(
                                "about:blank"
                            )

                            view.postDelayed({

                                if (
                                    !isFinishing &&
                                    !isDestroyed
                                ) {

                                    try {
                                        view.destroy()
                                    } catch (_: Exception) {
                                    }

                                    try {
                                        recreate()
                                    } catch (_: Exception) {
                                    }
                                }

                            }, 150)

                        } catch (_: Exception) {

                            try {
                                recreate()
                            } catch (_: Exception) {
                            }
                        }
                    }

                    return true
                }
            }


        webView.webChromeClient =
            object : WebChromeClient() {


                /*
                 * CAMERA / MICROPHONE
                 */
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


                        val origin =
                            request.origin.toString()


                        val allowedOrigin =
                            origin.startsWith(
                                "https://ss-enterprises-abha-app-2026.onrender.com"
                            ) ||
                            origin.startsWith(
                                "https://abha.abdm.gov.in"
                            ) ||
                            origin.contains(
                                ".abdm.gov.in"
                            )


                        if (!allowedOrigin) {

                            try {
                                request.deny()
                            } catch (_: Exception) {
                            }

                            return@runOnUiThread
                        }


                        val resources =
                            request.resources
                                .filter { resource ->

                                    (
                                        resource ==
                                            PermissionRequest
                                                .RESOURCE_VIDEO_CAPTURE
                                        &&
                                        ContextCompat
                                            .checkSelfPermission(
                                                this@MainActivity,
                                                Manifest.permission.CAMERA
                                            ) ==
                                            PackageManager.PERMISSION_GRANTED
                                    )
                                    ||
                                    (
                                        resource ==
                                            PermissionRequest
                                                .RESOURCE_AUDIO_CAPTURE
                                        &&
                                        ContextCompat
                                            .checkSelfPermission(
                                                this@MainActivity,
                                                Manifest.permission.RECORD_AUDIO
                                            ) ==
                                            PackageManager.PERMISSION_GRANTED
                                    )

                                }
                                .toTypedArray()


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
                 * FILE UPLOAD
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

                    fileCallback =
                        callback


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


                /*
                 * BLOCK POPUP / NEW WINDOW
                 *
                 * Navigation will remain in the same
                 * WebView.
                 */
                override fun onCreateWindow(
                    view: WebView?,
                    isDialog: Boolean,
                    isUserGesture: Boolean,
                    resultMsg: Message?
                ): Boolean {

                    return false
                }
            }
    }


    /*
     * CENTRAL NAVIGATION HANDLER
     */
    private fun handleNavigation(
        view: WebView,
        urlString: String
    ): Boolean {

        if (urlString.isBlank()) {
            return false
        }


        val cleanUrl =
            urlString.trim()

        val lower =
            cleanUrl.lowercase()


        /*
         * ABHA INTENT URL
         *
         * Example:
         *
         * intent://#Intent;
         * scheme=abha;
         * package=in.ndhm.phr;
         * ...
         */
        if (
            lower.startsWith("intent://")
        ) {

            return openIntentUrl(
                cleanUrl
            )
        }


        /*
         * Direct ABHA custom scheme
         */
        if (
            lower.startsWith("abha://") ||
            lower.startsWith("abha:")
        ) {

            return openAbhaApp(
                cleanUrl
            )
        }


        val uri =
            try {

                Uri.parse(
                    cleanUrl
                )

            } catch (_: Exception) {

                return false
            }


        val scheme =
            uri.scheme
                ?.lowercase()
                ?: return false


        /*
         * NORMAL WEB URL
         */
        if (
            scheme == "http" ||
            scheme == "https"
        ) {

            val host =
                uri.host


            /*
             * Keep SS Enterprises and ABHA
             * inside WebView.
             */
            if (
                isAllowedWebHost(host)
            ) {

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
         * Other Android schemes.
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
     * INTENT:// HANDLER
     */
    private fun openIntentUrl(
        urlString: String
    ): Boolean {

        if (intentBeingHandled) {
            return true
        }


        intentBeingHandled = true


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
             * If ABHA package is explicitly present,
             * keep it targeted to ABHA app.
             */
            if (
                intent.`package`.isNullOrBlank()
            ) {

                intent.setPackage(
                    abhaPackage
                )
            }


            try {

                startActivity(
                    intent
                )

                true

            } catch (
                _: ActivityNotFoundException
            ) {

                /*
                 * If the exact ABHA intent cannot be
                 * opened, try launching the installed
                 * ABHA application directly.
                 */
                launchInstalledAbhaApp()

            } catch (_: Exception) {

                launchInstalledAbhaApp()
            }

        } catch (_: Exception) {

            launchInstalledAbhaApp()

        } finally {

            webView.postDelayed({

                intentBeingHandled =
                    false

            }, 1500)
        }
    }


    /*
     * DIRECT ABHA:// HANDLER
     */
    private fun openAbhaApp(
        urlString: String
    ): Boolean {

        if (intentBeingHandled) {
            return true
        }


        intentBeingHandled = true


        return try {

            val uri =
                Uri.parse(
                    urlString
                )


            val intent =
                Intent(
                    Intent.ACTION_VIEW,
                    uri
                ).apply {

                    setPackage(
                        abhaPackage
                    )

                    addCategory(
                        Intent.CATEGORY_BROWSABLE
                    )
                }


            try {

                startActivity(
                    intent
                )

                true

            } catch (
                _: ActivityNotFoundException
            ) {

                launchInstalledAbhaApp()

            } catch (_: Exception) {

                launchInstalledAbhaApp()
            }

        } catch (_: Exception) {

            launchInstalledAbhaApp()

        } finally {

            webView.postDelayed({

                intentBeingHandled =
                    false

            }, 1500)
        }
    }


    /*
     * Launch installed ABHA app directly.
     */
    private fun launchInstalledAbhaApp(): Boolean {

        return try {

            val launchIntent =
                packageManager
                    .getLaunchIntentForPackage(
                        abhaPackage
                    )


            if (
                launchIntent != null
            ) {

                launchIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                )

                startActivity(
                    launchIntent
                )

                true

            } else {

                openAbhaPlayStore()
            }

        } catch (_: Exception) {

            openAbhaPlayStore()
        }
    }


    /*
     * ABHA PLAY STORE FALLBACK
     */
    private fun openAbhaPlayStore(): Boolean {

        return openPackageStore(
            abhaPackage
        )
    }


    private fun openPackageStore(
        packageName: String
    ): Boolean {

        return try {

            try {

                startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(
                            "market://details?id=$packageName"
                        )
                    )
                )

            } catch (
                _: ActivityNotFoundException
            ) {

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

        } catch (_: Exception) {

            false
        }
    }


    /*
     * ANDROID PERMISSIONS
     */
    private fun requestNeededPermissions() {

        val needed =
            arrayOf(
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ).filter {

                ContextCompat
                    .checkSelfPermission(
                        this,
                        it
                    ) !=
                    PackageManager.PERMISSION_GRANTED
            }


        if (
            needed.isNotEmpty()
        ) {

            ActivityCompat.requestPermissions(
                this,
                needed.toTypedArray(),
                permissionRequestCode
            )
        }
    }


    /*
     * FILE RESULT
     */
    @Deprecated(
        "Deprecated in Android API 33; retained for compatibility"
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
                ?.onReceiveValue(
                    results
                )


            fileCallback = null
        }
    }


    /*
     * SAVE WEBVIEW STATE
     */
    override fun onSaveInstanceState(
        outState: Bundle
    ) {

        try {

            webView.saveState(
                outState
            )

        } catch (_: Exception) {
        }


        super.onSaveInstanceState(
            outState
        )
    }


    /*
     * CLEANUP
     */
    override fun onDestroy() {

        try {

            fileCallback
                ?.onReceiveValue(null)

        } catch (_: Exception) {
        }


        fileCallback = null


        try {

            webView.stopLoading()

            webView.webChromeClient =
                null

            webView.webViewClient =
                null

            webView.destroy()

        } catch (_: Exception) {
        }


        super.onDestroy()
    }
}
