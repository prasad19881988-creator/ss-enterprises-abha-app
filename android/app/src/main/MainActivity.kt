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

    private var rendererRecoveryInProgress = false

    private var openingExternalApp = false


    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        configureWebView()

        requestNeededPermissions()

        if (savedInstanceState == null) {
            loadPortal()
        } else {
            try {
                val restored = webView.restoreState(savedInstanceState)

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
        }
    }


    private fun isAllowedWebHost(
        host: String?
    ): Boolean {

        val h = host?.lowercase() ?: return false

        return h == "ss-enterprises-abha-app-2026.onrender.com" ||
                h == "abha.abdm.gov.in" ||
                h.endsWith(".abdm.gov.in") ||
                h == "localhost"
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

            cacheMode = WebSettings.LOAD_DEFAULT

            mixedContentMode =
                WebSettings.MIXED_CONTENT_NEVER_ALLOW

            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            /*
             * Keep navigation in this WebView.
             */
            setSupportMultipleWindows(false)

            userAgentString =
                "$userAgentString SS-ENTERPRISES-ABHA-Android/4.6"
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
                 * Android 7+
                 */
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {

                    return processUrl(
                        request.url.toString()
                    )
                }


                /*
                 * Older Android compatibility
                 */
                @Suppress("DEPRECATION")
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    url: String
                ): Boolean {

                    return processUrl(url)
                }


                /*
                 * Extra navigation-level backup.
                 */
                override fun onPageStarted(
                    view: WebView,
                    url: String,
                    favicon: android.graphics.Bitmap?
                ) {

                    if (isExternalAppUrl(url)) {

                        try {
                            view.stopLoading()
                        } catch (_: Exception) {
                        }

                        processUrl(url)

                        return
                    }

                    super.onPageStarted(
                        view,
                        url,
                        favicon
                    )
                }


                /*
                 * Resource-level backup.
                 */
                override fun onLoadResource(
                    view: WebView,
                    url: String
                ) {

                    if (isExternalAppUrl(url)) {

                        try {
                            view.stopLoading()
                        } catch (_: Exception) {
                        }

                        processUrl(url)

                        return
                    }

                    super.onLoadResource(
                        view,
                        url
                    )
                }


                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {

                    val url =
                        request.url.toString()

                    if (isExternalAppUrl(url)) {

                        processUrl(url)

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

                        rendererRecoveryInProgress = true

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
                                    ) ||
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
     * Detect any Android application URL.
     *
     * This is NOT limited to ABHA.
     */
    private fun isExternalAppUrl(
        url: String
    ): Boolean {

        val u =
            url.trim().lowercase()

        return u.startsWith("intent://") ||
                u.startsWith("android-app://") ||
                u.startsWith("abha://") ||
                u.startsWith("abha:") ||
                u.startsWith("aadhaar://") ||
                u.startsWith("aadhar://") ||
                u.startsWith("face://")
    }


    /*
     * Main URL processor.
     */
    private fun processUrl(
        url: String
    ): Boolean {

        if (url.isBlank()) {
            return false
        }


        val clean =
            url.trim()


        /*
         * intent://
         */
        if (
            clean.lowercase()
                .startsWith("intent://")
        ) {

            return launchIntentUri(
                clean
            )
        }


        /*
         * android-app://
         */
        if (
            clean.lowercase()
                .startsWith("android-app://")
        ) {

            return launchAndroidAppUri(
                clean
            )
        }


        /*
         * Other direct custom schemes.
         */
        if (
            clean.lowercase()
                .startsWith("abha://") ||
            clean.lowercase()
                .startsWith("abha:") ||
            clean.lowercase()
                .startsWith("aadhaar://") ||
            clean.lowercase()
                .startsWith("aadhar://") ||
            clean.lowercase()
                .startsWith("face://")
        ) {

            return launchCustomScheme(
                clean
            )
        }


        val uri =
            try {
                Uri.parse(clean)
            } catch (_: Exception) {
                return false
            }


        val scheme =
            uri.scheme?.lowercase()
                ?: return false


        /*
         * Normal website.
         */
        if (
            scheme == "http" ||
            scheme == "https"
        ) {

            if (
                isAllowedWebHost(
                    uri.host
                )
            ) {

                return false
            }


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


        return false
    }


    /*
     * Generic intent:// parser.
     *
     * IMPORTANT:
     *
     * We do not hard-code only in.ndhm.phr.
     *
     * Whatever package/action/data is supplied by
     * the website is passed to Android.
     */
    private fun launchIntentUri(
        url: String
    ): Boolean {

        if (openingExternalApp) {
            return true
        }


        openingExternalApp = true


        try {

            val parsedIntent =
                try {

                    Intent.parseUri(
                        url,
                        Intent.URI_INTENT_SCHEME
                    )

                } catch (_: Exception) {

                    null
                }


            if (parsedIntent == null) {

                openingExternalApp = false

                return false
            }


            /*
             * Preserve the exact intent generated by
             * the website.
             */
            parsedIntent.addCategory(
                Intent.CATEGORY_BROWSABLE
            )


            /*
             * First try the exact Intent.
             */
            try {

                startActivity(
                    parsedIntent
                )

                return true

            } catch (
                _: ActivityNotFoundException
            ) {
            } catch (_: Exception) {
            }


            /*
             * If exact Intent failed, use the package
             * specified inside #Intent;package=...
             */
            val packageName =
                parsedIntent.`package`


            if (
                !packageName.isNullOrBlank()
            ) {

                try {

                    val launchIntent =
                        packageManager
                            .getLaunchIntentForPackage(
                                packageName
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

                        return true
                    }

                } catch (_: Exception) {
                }
            }


            /*
             * Final generic fallback:
             * let Android resolve the underlying
             * data URI.
             */
            try {

                val data =
                    parsedIntent.data


                if (data != null) {

                    val fallback =
                        Intent(
                            Intent.ACTION_VIEW,
                            data
                        )

                    if (
                        !packageName.isNullOrBlank()
                    ) {

                        fallback.setPackage(
                            packageName
                        )
                    }

                    startActivity(
                        fallback
                    )

                    return true
                }

            } catch (_: Exception) {
            }


            return false

        } finally {

            webView.postDelayed({

                openingExternalApp = false

            }, 1200)
        }
    }


    /*
     * android-app://package/...
     */
    private fun launchAndroidAppUri(
        url: String
    ): Boolean {

        return try {

            val intent =
                Intent.parseUri(
                    url,
                    Intent.URI_INTENT_SCHEME
                )

            intent.addCategory(
                Intent.CATEGORY_BROWSABLE
            )

            startActivity(intent)

            true

        } catch (_: Exception) {

            false
        }
    }


    /*
     * Direct custom scheme.
     *
     * Example:
     * abha://...
     * aadhaar://...
     * face://...
     */
    private fun launchCustomScheme(
        url: String
    ): Boolean {

        return try {

            val uri =
                Uri.parse(url)


            val intent =
                Intent(
                    Intent.ACTION_VIEW,
                    uri
                )


            startActivity(intent)

            true

        } catch (
            _: ActivityNotFoundException
        ) {

            false

        } catch (_: Exception) {

            false
        }
    }


    private fun requestNeededPermissions() {

        val needed =
            arrayOf(
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ).filter {

                ContextCompat.checkSelfPermission(
                    this,
                    it
                ) != PackageManager.PERMISSION_GRANTED
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


    override fun onDestroy() {

        try {
            fileCallback
                ?.onReceiveValue(null)
        } catch (_: Exception) {
        }

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
