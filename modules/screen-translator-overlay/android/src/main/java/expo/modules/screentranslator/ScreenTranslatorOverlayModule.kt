package expo.modules.screentranslator

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ScreenTranslatorOverlayModule : Module() {

  companion object {
    var instance: ScreenTranslatorOverlayModule? = null
      private set

    private var pendingStartPromise: Promise? = null

    fun onServiceStartResult(success: Boolean, errorMessage: String?) {
      val promise = pendingStartPromise
      pendingStartPromise = null
      if (success) {
        promise?.resolve(true)
      } else {
        promise?.reject("PERMISSION_DENIED", errorMessage ?: "未能开启悬浮翻译服务", null)
      }
    }

    fun emitScreenCaptured(
      filePath: String,
      width: Int,
      height: Int,
      detectedBubbles: List<Map<String, Any>> = emptyList()
    ) {
      instance?.sendEvent(
        "onScreenCaptured",
        mapOf(
          "uri" to "file://$filePath",
          "width" to width,
          "height" to height,
          "timestamp" to System.currentTimeMillis(),
          "detectedBubbles" to detectedBubbles
        )
      )
    }

    fun emitServiceStateChanged(running: Boolean) {
      instance?.sendEvent(
        "onServiceStateChanged",
        mapOf("running" to running)
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ScreenTranslatorOverlay")

    Events("onScreenCaptured", "onServiceStateChanged")

    OnCreate {
      instance = this@ScreenTranslatorOverlayModule
    }

    OnDestroy {
      if (instance == this@ScreenTranslatorOverlayModule) {
        instance = null
      }
    }

    Function("isSupported") {
      true
    }

    Function("isOverlayPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(context)
      } else {
        true
      }
    }

    Function("requestOverlayPermission") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        if (!Settings.canDrawOverlays(context)) {
          val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}")
          ).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          context.startActivity(intent)
          return@Function false
        }
      }
      true
    }

    Function("isServiceRunning") {
      ScreenCaptureOverlayService.isRunning()
    }

    AsyncFunction("startOverlayService") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("CONTEXT_NULL", "React 上下文不可用", null)
        return@AsyncFunction
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
        promise.reject("OVERLAY_PERMISSION_REQUIRED", "请先在系统设置中授予【在其他应用上层显示】悬浮窗权限", null)
        return@AsyncFunction
      }

      if (ScreenCaptureOverlayService.isRunning()) {
        promise.resolve(true)
        return@AsyncFunction
      }

      pendingStartPromise = promise

      // 启动透明 Activity 弹出 Android 系统的 MediaProjection 录屏截屏授权对话框
      val intent = Intent(context, ScreenCapturePermissionActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      context.startActivity(intent)
    }

    Function("stopOverlayService") {
      val context = appContext.reactContext ?: return@Function false
      ScreenCaptureOverlayService.stop(context)
      true
    }

    AsyncFunction("recognizeImage") { imageUri: String, lang: String?, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("CONTEXT_NULL", "React Context 不可用", null)
        return@AsyncFunction
      }

      CoroutineScope(Dispatchers.IO).launch {
        var bitmap: Bitmap? = null
        try {
          // 稳健支持 content://, file:// 及本地绝对路径
          bitmap = try {
            if (imageUri.startsWith("content://")) {
              context.contentResolver.openInputStream(Uri.parse(imageUri))?.use {
                BitmapFactory.decodeStream(it)
              }
            } else {
              val cleanPath = if (imageUri.startsWith("file://")) {
                Uri.parse(imageUri).path ?: imageUri.removePrefix("file://")
              } else {
                imageUri
              }
              val file = java.io.File(cleanPath)
              if (file.exists()) {
                BitmapFactory.decodeFile(file.absolutePath)
              } else {
                context.contentResolver.openInputStream(Uri.parse(imageUri))?.use {
                  BitmapFactory.decodeStream(it)
                }
              }
            }
          } catch (e: Exception) {
            null
          }

          if (bitmap == null) {
            promise.reject("DECODE_FAILED", "无法解码指定图片: $imageUri", null)
            return@launch
          }

          val bubbles = MangaOcrProcessor.processImage(bitmap, lang ?: "ja")
          val response = mapOf(
            "width" to bitmap.width,
            "height" to bitmap.height,
            "bubbles" to bubbles
          )
          promise.resolve(response)
        } catch (e: Exception) {
          promise.reject("OCR_ERROR", e.message ?: "文字定位识别发生异常", e)
        } finally {
          try {
            bitmap?.recycle()
          } catch (e: Exception) {}
        }
      }
    }

    Function("captureScreen") {
      if (ScreenCaptureOverlayService.isRunning()) {
        ScreenCaptureOverlayService.triggerScreenCapture()
        true
      } else {
        false
      }
    }

    Function("updateTranslationResult") { bubblesJson: String ->
      if (ScreenCaptureOverlayService.isRunning()) {
        ScreenCaptureOverlayService.updateTranslationResult(bubblesJson)
        true
      } else {
        false
      }
    }
  }
}
