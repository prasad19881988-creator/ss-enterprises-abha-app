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

    // ---------------------------------------------------------
    // ACTIVITY
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // LOAD MAIN WEBSITE
    // ---------------------------------------------------------

    private fun loadPortal() {

        if (isFinishing || isDestroyed) {
            return
        }

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

    // ---------------------------------------------------------
    // HOST CONTROL
    // ---------------------------------------------------------

    private fun isAllowedWebHost(host: String?): Boolean {

        val h = host?.lowercase() ?: return false

        return (
            h == "ss-enterprises-abha-app-2026.onrender.com" ||
            h == "abha.abdm.gov.in" ||
            h.endsWith(".abdm.gov.in") ||
            h == "localhost"
        )
    }

    // ---------------------------------------------------------
    // WEBVIEW CONFIGURATION
    // ---------------------------------------------------------

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

            // IMPORTANT:
            // Prevent target="_blank"/new-window navigation
            // from bypassing our URL handling.
            setSupportMultipleWindows(false)

            userAgentString =
                "$userAgentString SS-ENTERPRISES-ABHA-Android/4.3"
        }

        CookieManager.getInstance().setAcceptCookie(true)

        CookieManager.getInstance()
            .setAcceptThirdPartyCookies(webView, true)

        // -----------------------------------------------------
        // WEBVIEW CLIENT
        // -----------------------------------------------------

        webView.webViewClient = object : WebViewClient() {

            // Android 5+
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {

                return handleNavigation(
                    view,
                    request.url.toString()
                )
            }

            // Older Android compatibility
            @Suppress("DEPRECATION")
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

                super.onReceivedError(
                    view,
                    request,
                    error
                )
            }

            // -------------------------------------------------
            // WEBVIEW RENDERER CRASH RECOVERY
            // -------------------------------------------------

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

        // -----------------------------------------------------
        // WEB CHROME CLIENT
        // -----------------------------------------------------

        webView.webChromeClient = object : WebChromeClient() {

            // -------------------------------------------------
            // CAMERA / MICROPHONE
            // -------------------------------------------------

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

            // -------------------------------------------------
            // FILE UPLOAD
            // -------------------------------------------------

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

            // -------------------------------------------------
            // NEW WINDOW / TARGET BLANK
            // -------------------------------------------------

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {

                // Multiple windows are deliberately disabled.
                // Returning false prevents a second hidden WebView
                // from being created and keeps navigation in the
                // existing WebView.
                return false
            }
        }
    }

    // ---------------------------------------------------------
    // NAVIGATION HANDLER
    // ---------------------------------------------------------

    private fun handleNavigation(
        view: WebView,
        urlString: String
    ): Boolean {

        if (urlString.isBlank()) {
            return false
        }

        val lower =
            urlString.trim().lowercase()

        // -----------------------------------------------------
        // 1. ANDROID INTENT URL
        // -----------------------------------------------------

        if (lower.startsWith("intent://")) {

            return openIntentUrl(urlString)
        }

        // -----------------------------------------------------
        // 2. ABHA CUSTOM SCHEME
        // -----------------------------------------------------

        if (
            lower.startsWith("abha://") ||
            lower.startsWith("abha:")
        ) {

            return openAbhaApp(urlString)
        }

        // -----------------------------------------------------
        // 3. NORMAL HTTP / HTTPS
        // -----------------------------------------------------

        val uri =
            try {

                Uri.parse(urlString)

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

            val host =
                uri.host

            if (isAllowedWebHost(host)) {

                // Keep approved web pages inside our WebView.
                return false
            }

            // Other websites open externally.
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

        // -----------------------------------------------------
        // 4. OTHER CUSTOM SCHEMES
        // -----------------------------------------------------

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

    // ---------------------------------------------------------
    // INTENT:// HANDLER
    // ---------------------------------------------------------

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

            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
            )

            // -------------------------------------------------
            // IMPORTANT:
            // ABHA intent specifically targets this package.
            // -------------------------------------------------

            val targetPackage =
                intent.`package`

            if (
                targetPackage == abhaPackage
            ) {

                return try {

                    startActivity(intent)

                    true

                } catch (_: ActivityNotFoundException) {

                    openAbhaPlayStore()

                } catch (_: Exception) {

                    openAbhaPlayStore()
                }
            }

            // For any other valid intent, try normally.

            try {

                startActivity(intent)

                true

            } catch (_: ActivityNotFoundException) {

                val packageName =
                    intent.`package`

                if (
                    packageName.isNullOrBlank()
                ) {

                    false

                } else {

                    openPackageStore(
                        packageName
                    )
                }
            }

        } catch (_: Exception) {

            false
        }
    }

    // ---------------------------------------------------------
    // DIRECT ABHA APP
    // ---------------------------------------------------------

    private fun openAbhaApp(
        urlString: String
    ): Boolean {

        return try {

            val uri =
                Uri.parse(urlString)

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

            startActivity(intent)

            true

        } catch (_: ActivityNotFoundException) {

            openAbhaPlayStore()

        } catch (_: Exception) {

            openAbhaPlayStore()
        }
    }

    // ---------------------------------------------------------
    // PLAY STORE - ABHA
    // ---------------------------------------------------------

    private fun openAbhaPlayStore(): Boolean {

        return openPackageStore(abhaPackage)
    }

    // ---------------------------------------------------------
    // PLAY STORE / PACKAGE STORE
    // ---------------------------------------------------------

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

        } catch (_: Exception) {

            false
        }
    }

    // ---------------------------------------------------------
    // ANDROID PERMISSIONS
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // FILE RESULT
    // ---------------------------------------------------------

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

            fileCallback?.onReceiveValue(
                results
            )

            fileCallback = null
        }
    }

    // ---------------------------------------------------------
    // SAVE WEBVIEW STATE
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------

    override fun onDestroy() {

        try {

            fileCallback?.onReceiveValue(
                null
            )

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
