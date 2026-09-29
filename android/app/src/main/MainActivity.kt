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
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.ByteArrayInputStream

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

    private var launchingAbha = false


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


    private fun isAllowedWebHost(host: String?): Boolean {

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

            setSupportMultipleWindows(false)

            userAgentString =
                "$userAgentString SS-ENTERPRISES-ABHA-Android/4.5"
        }


        CookieManager.getInstance().setAcceptCookie(true)

        CookieManager.getInstance()
            .setAcceptThirdPartyCookies(webView, true)


        /*
         * JavaScript bridge.
         *
         * If ABHA page creates intent:// through a
         * clickable link, JavaScript will catch it
         * before WebView tries to load it.
         */
        webView.addJavascriptInterface(
            AbhaBridge(),
            "SSABHA"
        )


        webView.webViewClient =
            object : WebViewClient() {


                /*
                 * Normal navigation interception.
                 */
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


                /*
                 * IMPORTANT BACKUP.
                 *
                 * This catches intent:// even if WebView
                 * does not call shouldOverrideUrlLoading().
                 */
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {

                    val url =
                        request.url.toString()

                    if (isSpecialAbhaUrl(url)) {

                        runOnUiThread {

                            if (!isFinishing && !isDestroyed) {
                                handleNavigation(url)
                            }
                        }

                        /*
                         * Return an empty response so WebView
                         * does not continue trying to load
                         * intent:// as a web page.
                         */
                        return WebResourceResponse(
                            "text/plain",
                            "UTF-8",
                            ByteArrayInputStream(
                                ByteArray(0)
                            )
                        )
                    }

                    return super.shouldInterceptRequest(
                        view,
                        request
                    )
                }


                @Suppress("DEPRECATION")
                override fun shouldInterceptRequest(
                    view: WebView,
                    url: String
                ): WebResourceResponse? {

                    if (isSpecialAbhaUrl(url)) {

                        runOnUiThread {

                            if (!isFinishing && !isDestroyed) {
                                handleNavigation(url)
                            }
                        }

                        return WebResourceResponse(
                            "text/plain",
                            "UTF-8",
                            ByteArrayInputStream(
                                ByteArray(0)
                            )
                        )
                    }

                    return super.shouldInterceptRequest(
                        view,
                        url
                    )
                }


                /*
                 * JavaScript click interception is installed
                 * after ABHA page loads.
                 */
                override fun onPageFinished(
                    view: WebView,
                    url: String
                ) {

                    super.onPageFinished(
                        view,
                        url
                    )

                    installAbhaIntentInterceptor(view)
                }


                /*
                 * Final error backup.
                 */
                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {

                    val url =
                        request.url.toString()

                    if (isSpecialAbhaUrl(url)) {

                        runOnUiThread {

                            if (!isFinishing && !isDestroyed) {
                                handleNavigation(url)
                            }
                        }

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
                            view.loadUrl("about:blank")

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
                            origin.contains(".abdm.gov.in")


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
                                                .RESOURCE_VIDEO_CAPTURE &&
                                        ContextCompat.checkSelfPermission(
                                            this@MainActivity,
                                            Manifest.permission.CAMERA
                                        ) ==
                                            PackageManager.PERMISSION_GRANTED
                                    ) ||
                                    (
                                        resource ==
                                            PermissionRequest
                                                .RESOURCE_AUDIO_CAPTURE &&
                                        ContextCompat.checkSelfPermission(
                                            this@MainActivity,
                                            Manifest.permission.RECORD_AUDIO
                                        ) ==
                                            PackageManager.PERMISSION_GRANTED
                                    )
                                }
                                .toTypedArray()


                        try {

                            if (resources.isNotEmpty()) {
                                request.grant(resources)
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
                    callback: ValueCallback<Array<Uri>>?,
                    params: FileChooserParams?
                ): Boolean {

                    fileCallback?.onReceiveValue(null)

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

                        fileCallback?.onReceiveValue(null)
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
     * JavaScript interceptor.
     *
     * It watches links/clicks for intent:// and
     * sends them directly to Android.
     */
    private fun installAbhaIntentInterceptor(
        view: WebView
    ) {

        val js = """
            (function() {

                if (window.__SS_ABHA_INTENT_HOOK__) {
                    return;
                }

                window.__SS_ABHA_INTENT_HOOK__ = true;

                document.addEventListener(
                    'click',
                    function(e) {

                        var el = e.target;

                        while (
                            el &&
                            el.tagName !== 'A'
                        ) {
                            el = el.parentElement;
                        }

                        if (!el) {
                            return;
                        }

                        var href =
                            el.getAttribute('href');

                        if (!href) {
                            return;
                        }

                        href = String(href);

                        if (
                            href.indexOf('intent://') === 0 ||
                            href.indexOf('abha://') === 0 ||
                            href.indexOf('abha:') === 0
                        ) {

                            e.preventDefault();
                            e.stopPropagation();

                            try {
                                window.SSABHA.open(
                                    href
                                );
                            } catch (_) {
                            }

                            return false;
                        }

                    },
                    true
                );

            })();
        """.trimIndent()


        try {
            view.evaluateJavascript(
                js,
                null
            )
        } catch (_: Exception) {
        }
    }


    private fun isSpecialAbhaUrl(
        url: String
    ): Boolean {

        val u =
            url.trim().lowercase()

        return u.startsWith("intent://") ||
                u.startsWith("abha://") ||
                u.startsWith("abha:")
    }


    private fun handleNavigation(
        urlString: String
    ): Boolean {

        if (urlString.isBlank()) {
            return false
        }


        val url =
            urlString.trim()


        if (
            url.lowercase()
                .startsWith("intent://")
        ) {

            return launchAbhaFromIntent(url)
        }


        if (
            url.lowercase()
                .startsWith("abha://") ||
            url.lowercase()
                .startsWith("abha:")
        ) {

            return launchAbhaDirect(url)
        }


        val uri =
            try {
                Uri.parse(url)
            } catch (_: Exception) {
                return false
            }


        val scheme =
            uri.scheme?.lowercase()
                ?: return false


        if (
            scheme == "http" ||
            scheme == "https"
        ) {

            if (
                isAllowedWebHost(uri.host)
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
     * Parse intent:// only to confirm that it is
     * an ABHA intent, then launch ABHA package.
     *
     * We intentionally do NOT ask WebView to load
     * the intent URL.
     */
    private fun launchAbhaFromIntent(
        url: String
    ): Boolean {

        if (launchingAbha) {
            return true
        }

        launchingAbha = true


        try {

            val parsed =
                try {
                    Intent.parseUri(
                        url,
                        Intent.URI_INTENT_SCHEME
                    )
                } catch (_: Exception) {
                    null
                }


            val packageName =
                parsed?.`package`


            if (
                packageName != null &&
                packageName != abhaPackage
            ) {

                launchingAbha = false

                return false
            }


            return launchInstalledAbha()

        } finally {

            webView.postDelayed({

                launchingAbha = false

            }, 1500)
        }
    }


    private fun launchAbhaDirect(
        url: String
    ): Boolean {

        if (launchingAbha) {
            return true
        }

        launchingAbha = true


        return try {

            val uri =
                Uri.parse(url)


            val intent =
                Intent(
                    Intent.ACTION_VIEW,
                    uri
                ).apply {

                    setPackage(abhaPackage)

                    addCategory(
                        Intent.CATEGORY_BROWSABLE
                    )
                }


            try {

                startActivity(intent)

                true

            } catch (_: ActivityNotFoundException) {

                launchInstalledAbha()

            } catch (_: Exception) {

                launchInstalledAbha()
            }

        } finally {

            webView.postDelayed({

                launchingAbha = false

            }, 1500)
        }
    }


    /*
     * Directly launch the installed ABHA app.
     */
    private fun launchInstalledAbha(): Boolean {

        return try {

            val launchIntent =
                packageManager
                    .getLaunchIntentForPackage(
                        abhaPackage
                    )


            if (launchIntent != null) {

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


    private fun openAbhaPlayStore(): Boolean {

        return try {

            try {

                startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(
                            "market://details?id=$abhaPackage"
                        )
                    )
                )

            } catch (_: ActivityNotFoundException) {

                startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(
                            "https://play.google.com/store/apps/details?id=$abhaPackage"
                        )
                    )
                )
            }

            true

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


        if (needed.isNotEmpty()) {

            ActivityCompat.requestPermissions(
                this,
                needed.toTypedArray(),
                permissionRequestCode
            )
        }
    }


    /*
     * JavaScript → Android bridge.
     */
    inner class AbhaBridge {

        @JavascriptInterface
        fun open(url: String?) {

            if (url.isNullOrBlank()) {
                return
            }


            runOnUiThread {

                if (
                    !isFinishing &&
                    !isDestroyed
                ) {

                    handleNavigation(url)
                }
            }
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
            requestCode == fileRequestCode
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


            fileCallback?.onReceiveValue(
                results
            )

            fileCallback = null
        }
    }


    override fun onSaveInstanceState(
        outState: Bundle
    ) {

        try {
            webView.saveState(outState)
        } catch (_: Exception) {
        }

        super.onSaveInstanceState(outState)
    }


    override fun onDestroy() {

        try {
            fileCallback?.onReceiveValue(null)
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
