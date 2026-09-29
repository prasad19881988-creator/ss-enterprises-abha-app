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
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
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

    private val abhaPackage = "in.ndhm.phr"
    private val faceRdPackage = "in.gov.uidai.facerd"

    private var rendererRecoveryInProgress = false

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
            try {
                webView.postDelayed({
                    if (!isFinishing && !isDestroyed) {
                        webView.loadUrl(appUrl)
                    }
                }, 1000)
            } catch (_: Exception) {
            }
        }
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
             * IMPORTANT:
             * Allow popup/new-window requests because some government
             * portals use target="_blank" / window.open() for external
             * application launching.
             */
            setSupportMultipleWindows(true)

            userAgentString =
                "$userAgentString SS-ENTERPRISES-ABHA-Android/4.3"
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance()
            .setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {

            /*
             * MAIN FIX
             *
             * intent:// and other application schemes are intercepted
             * BEFORE WebView attempts to load them.
             */
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {

                return handleNavigation(
                    view,
                    request.url.toString()
                )
            }

            /*
             * Older Android/WebView compatibility.
             */
            @Deprecated("Deprecated in API 24")
            override fun shouldOverrideUrlLoading(
                view: WebView,
                url: String
            ): Boolean {

                return handleNavigation(view, url)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                /*
                 * DO NOT try to launch intent here.
                 *
                 * If an intent reaches this callback, it is already too late.
                 * Navigation interception above prevents that situation.
                 */
                super.onReceivedError(view, request, error)
            }

            override fun onRenderProcessGone(
                view: WebView,
                detail: android.webkit.RenderProcessGoneDetail
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

                            if (!isFinishing && !isDestroyed) {

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

        webView.webChromeClient = object : WebChromeClient() {

            /*
             * Some portals launch external apps through a popup/new window.
             *
             * We create a temporary child WebView and give it the SAME
             * navigation interceptor. Therefore intent:// never becomes a
             * WebView error page.
             */
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {

                if (view == null || resultMsg == null) {
                    return false
                }

                val popupWebView = WebView(this@MainActivity)

                popupWebView.settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    javaScriptCanOpenWindowsAutomatically = true
                    setSupportMultipleWindows(false)
                }

                popupWebView.webViewClient =
                    object : WebViewClient() {

                        override fun shouldOverrideUrlLoading(
                            child: WebView,
                            request: WebResourceRequest
                        ): Boolean {

                            val url = request.url.toString()

                            val handled =
                                handleNavigation(
                                    view,
                                    url
                                )

                            if (handled) {
                                removePopupWebView(popupWebView)
                            }

                            return handled
                        }

                        @Deprecated("Deprecated in API 24")
                        override fun shouldOverrideUrlLoading(
                            child: WebView,
                            url: String
                        ): Boolean {

                            val handled =
                                handleNavigation(
                                    view,
                                    url
                                )

                            if (handled) {
                                removePopupWebView(popupWebView)
                            }

                            return handled
                        }
                    }

                popupWebView.webChromeClient =
                    object : WebChromeClient() {

                        override fun onCloseWindow(window: WebView?) {
                            removePopupWebView(popupWebView)
                        }
                    }

                val container =
                    view.parent as? android.view.ViewGroup

                container?.addView(
                    popupWebView,
                    FrameLayout.LayoutParams(
                        1,
                        1
                    )
                )

                val transport =
                    resultMsg.obj as? WebView.WebViewTransport
                        ?: return false

                transport.webView = popupWebView
                resultMsg.sendToTarget()

                return true
            }

            override fun onPermissionRequest(
                request: PermissionRequest
            ) {

                runOnUiThread {

                    if (isFinishing || isDestroyed) {
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
                        )

                    if (!allowedOrigin) {
                        try {
                            request.deny()
                        } catch (_: Exception) {
                        }
                        return@runOnUiThread
                    }

                    val resources =
                        request.resources.filter { resource ->

                            (
                                resource ==
                                    PermissionRequest.RESOURCE_VIDEO_CAPTURE &&
                                ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.CAMERA
                                ) ==
                                    PackageManager.PERMISSION_GRANTED
                            ) ||

                            (
                                resource ==
                                    PermissionRequest.RESOURCE_AUDIO_CAPTURE &&
                                ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.RECORD_AUDIO
                                ) ==
                                    PackageManager.PERMISSION_GRANTED
                            )

                        }.toTypedArray()

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
                    params?.createIntent()
                        ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            type = "image/*"
                            addCategory(Intent.CATEGORY_OPENABLE)
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
        }
    }

    /*
     * Handles:
     *
     * intent://
     * android-app://
     * abha://
     * aadhaar://
     * aadhar://
     * face://
     * normal http/https
     */
    private fun handleNavigation(
        sourceView: WebView?,
        url: String
    ): Boolean {

        if (url.isBlank()) {
            return false
        }

        val lower =
            url.trim().lowercase()

        /*
         * NORMAL WEBSITE
         *
         * Keep our own website and ABHA portal inside WebView.
         */
        if (
            lower.startsWith("https://") ||
            lower.startsWith("http://")
        ) {

            return false
        }

        /*
         * EVERYTHING ELSE is an external application/protocol.
         *
         * IMPORTANT:
         * Return TRUE even when the application is not installed.
         * This prevents WebView from showing:
         *
         * ERR_UNKNOWN_URL_SCHEME
         */
        if (
            lower.startsWith("intent://") ||
            lower.startsWith("android-app://") ||
            lower.startsWith("abha://") ||
            lower.startsWith("abha:") ||
            lower.startsWith("aadhaar://") ||
            lower.startsWith("aadhar://") ||
            lower.startsWith("face://") ||
            lower.startsWith("facerd://")
        ) {

            launchExternalApplication(url)
            return true
        }

        /*
         * Other custom schemes.
         */
        if (
            !lower.startsWith("javascript:") &&
            !lower.startsWith("about:") &&
            !lower.startsWith("data:")
        ) {

            launchExternalApplication(url)
            return true
        }

        return false
    }

    private fun launchExternalApplication(
        originalUrl: String
    ) {

        try {

            /*
             * First: parse Android intent:// URI.
             */
            if (
                originalUrl
                    .lowercase()
                    .startsWith("intent://")
            ) {

                val parsedIntent =
                    Intent.parseUri(
                        originalUrl,
                        Intent.URI_INTENT_SCHEME
                    )

                parsedIntent.addCategory(
                    Intent.CATEGORY_BROWSABLE
                )

                /*
                 * Try exact intent first.
                 */
                try {

                    startActivity(parsedIntent)
                    return

                } catch (_: ActivityNotFoundException) {
                }

                /*
                 * If package is explicitly specified,
                 * check that package.
                 */
                val packageName =
                    parsedIntent.`package`

                if (!packageName.isNullOrBlank()) {

                    if (isPackageInstalled(packageName)) {

                        val launchIntent =
                            packageManager
                                .getLaunchIntentForPackage(
                                    packageName
                                )

                        if (launchIntent != null) {

                            try {
                                startActivity(
                                    launchIntent
                                )
                                return
                            } catch (_: Exception) {
                            }
                        }

                    } else {

                        showInstallDialog(packageName)
                        return
                    }
                }

                /*
                 * Fallback to the normal data URI
                 * contained in intent://.
                 */
                val fallbackUrl =
                    parsedIntent.data

                if (fallbackUrl != null) {

                    try {

                        startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                fallbackUrl
                            )
                        )

                        return

                    } catch (_: Exception) {
                    }
                }

                /*
                 * If ABHA was requested but not installed.
                 */
                if (
                    originalUrl
                        .lowercase()
                        .contains(abhaPackage)
                ) {

                    showInstallDialog(abhaPackage)
                    return
                }

                /*
                 * If FaceRD was requested but not installed.
                 */
                if (
                    originalUrl
                        .lowercase()
                        .contains(faceRdPackage)
                ) {

                    showInstallDialog(faceRdPackage)
                    return
                }

                return
            }

            /*
             * Direct custom-scheme URL.
             */
            val intent =
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(originalUrl)
                )

            intent.addCategory(
                Intent.CATEGORY_BROWSABLE
            )

            try {

                startActivity(intent)
                return

            } catch (_: ActivityNotFoundException) {
            }

            /*
             * Detect known application.
             */
            val lower =
                originalUrl.lowercase()

            when {

                lower.contains("facerd") ||
                    lower.startsWith("face:") -> {

                    if (
                        isPackageInstalled(
                            faceRdPackage
                        )
                    ) {

                        /*
                         * FaceRD is a headless application.
                         * Normally the requesting portal must invoke
                         * its capture intent.
                         */
                        try {
                            startActivity(intent)
                            return
                        } catch (_: Exception) {
                        }

                    } else {

                        showInstallDialog(
                            faceRdPackage
                        )

                        return
                    }
                }

                lower.startsWith("abha:") ||
                    lower.contains("abha") -> {

                    if (
                        isPackageInstalled(
                            abhaPackage
                        )
                    ) {

                        val launch =
                            packageManager
                                .getLaunchIntentForPackage(
                                    abhaPackage
                                )

                        if (launch != null) {
                            try {
                                startActivity(launch)
                                return
                            } catch (_: Exception) {
                            }
                        }

                    } else {

                        showInstallDialog(
                            abhaPackage
                        )

                        return
                    }
                }
            }

        } catch (_: Exception) {

            /*
             * Never allow an external-app launch failure
             * to become a WebView error page or crash.
             */
        }
    }

    private fun isPackageInstalled(
        packageName: String
    ): Boolean {

        return try {

            if (android.os.Build.VERSION.SDK_INT >= 33) {

                packageManager.getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )

            } else {

                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(
                    packageName,
                    0
                )
            }

            true

        } catch (_: Exception) {

            false
        }
    }

    private fun showInstallDialog(
        packageName: String
    ) {

        if (isFinishing || isDestroyed) {
            return
        }

        val isAbha =
            packageName == abhaPackage

        val title =
            if (isAbha) {
                "ABHA App Required"
            } else {
                "Aadhaar Face RD Required"
            }

        val message =
            if (isAbha) {
                "ABHA App is not installed on this phone. Please install it to continue."
            } else {
                "Aadhaar Face RD is not installed on this phone. Please install it to continue."
            }

        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Install") { _, _ ->

                openPlayStore(packageName)
            }
            .show()
    }

    private fun openPlayStore(
        packageName: String
    ) {

        val marketUri =
            Uri.parse(
                "market://details?id=$packageName"
            )

        val webUri =
            Uri.parse(
                "https://play.google.com/store/apps/details?id=$packageName"
            )

        try {

            startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    marketUri
                )
            )

        } catch (_: Exception) {

            try {

                startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        webUri
                    )
                )

            } catch (_: Exception) {
            }
        }
    }

    private fun removePopupWebView(
        popup: WebView
    ) {

        try {

            val parent =
                popup.parent as? android.view.ViewGroup

            parent?.removeView(popup)

            popup.stopLoading()
            popup.destroy()

        } catch (_: Exception) {
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

        if (requestCode == fileRequestCode) {

            val results =
                if (
                    resultCode == Activity.RESULT_OK &&
                    data != null
                ) {

                    WebChromeClient.FileChooserParams
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

        fileCallback?.onReceiveValue(null)
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
