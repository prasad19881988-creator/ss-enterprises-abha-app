package com.ssenterprises.abha

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
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

    private val appUrl = "https://ss-enterprises-abha-app-2026.onrender.com/"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        configureWebView()
        requestNeededPermissions()

        // Hamesha fresh aur live data load hoga, purana cached state load nahi hoga
        loadApp()

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

            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            javaScriptCanOpenWindowsAutomatically = true

            userAgentString = "$userAgentString SS-ENTERPRISES-ABHA-Android/4.3"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                val scheme = uri.scheme ?: return false

                if (scheme == "http" || scheme == "https") {
                    val host = uri.host ?: ""
                    if (host.endsWith("onrender.com") || host == "localhost") {
                        return false
                    }
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    } catch (_: Exception) {
                        false
                    }
                }
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: Exception) {
                    false
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    view.postDelayed({
                        if (!isFinishing && !isDestroyed) {
                            view.loadUrl(appUrl)
                        }
                    }, 1500)
                }
            }

            override fun onRenderProcessGone(
                view: WebView,
                detail: android.webkit.RenderProcessGoneDetail
            ): Boolean {
                try {
                    view.stopLoading()
                    view.removeAllViews()
                    view.destroy()
                } catch (_: Exception) {
                }
                if (!isFinishing && !isDestroyed) {
                    recreate()
                }
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) {
                        request.deny()
                        return@runOnUiThread
                    }

                    val allowedResources = request.resources.filter { resource ->
                        when (resource) {
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                                ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.CAMERA
                                ) == PackageManager.PERMISSION_GRANTED

                            PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                                ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.RECORD_AUDIO
                                ) == PackageManager.PERMISSION_GRANTED

                            else -> false
                        }
                    }.toTypedArray()

                    if (allowedResources.isNotEmpty()) {
                        request.grant(allowedResources)
                    } else {
                        request.deny()
                    }
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                val locationGranted =
                    ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED

                callback?.invoke(origin, locationGranted, false)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback

                val intent = try {
                    params?.createIntent()
                        ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            type = "image/*"
                            addCategory(Intent.CATEGORY_OPENABLE)
                        }
                } catch (_: Exception) {
                    Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "image/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                }

                return try {
                    startActivityForResult(
                        Intent.createChooser(intent, "Select File"),
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

    private fun loadApp() {
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

    private fun requestNeededPermissions() {
        val neededPermissions = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        if (neededPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                neededPermissions.toTypedArray(),
                permissionRequestCode
            )
        }
    }

    @Deprecated("Deprecated in Android API 33; retained for compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == fileRequestCode) {
            val results = if (resultCode == Activity.RESULT_OK && data != null) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else {
                null
            }
            fileCallback?.onReceiveValue(results)
            fileCallback = null
        }
    }

    override fun onDestroy() {
        try {
            fileCallback?.onReceiveValue(null)
            fileCallback = null

            webView.stopLoading()
            webView.removeAllViews()
            webView.destroy()
        } catch (_: Exception) {
        }
        super.onDestroy()
    }
}
