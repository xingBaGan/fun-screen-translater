package expo.modules.screentranslator

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch


class ScreenCaptureOverlayService : Service() {

  companion object {
    const val CHANNEL_ID = "screen_translator_overlay_channel"
    const val NOTIFICATION_ID = 202601
    const val ACTION_START = "expo.modules.screentranslator.START"
    const val ACTION_STOP = "expo.modules.screentranslator.STOP"
    const val EXTRA_RESULT_CODE = "extra_result_code"
    const val EXTRA_RESULT_DATA = "extra_result_data"

    var currentService: ScreenCaptureOverlayService? = null
      private set

    fun isRunning(): Boolean = currentService != null

    fun triggerScreenCapture() {
      currentService?.captureScreen()
    }

    fun updateTranslationResult(bubblesJson: String) {
      currentService?.updateTranslation(bubblesJson)
    }

    fun stop(context: Context) {
      val intent = Intent(context, ScreenCaptureOverlayService::class.java).apply {
        action = ACTION_STOP
      }
      context.stopService(intent)
      currentService?.teardown()
      currentService = null
    }
  }

  private var windowManager: WindowManager? = null
  private var floatingOverlayView: FloatingOverlayView? = null
  private var mediaProjectionManager: MediaProjectionManager? = null
  private var mediaProjection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  private var screenWidth = 1080
  private var screenHeight = 2400
  private var screenDensity = 420
  private var isCapturing = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    currentService = this
    createNotificationChannel()
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

    val displayMetrics = resources.displayMetrics
    screenWidth = displayMetrics.widthPixels
    screenHeight = displayMetrics.heightPixels
    screenDensity = displayMetrics.densityDpi

    floatingOverlayView = FloatingOverlayView(
      context = this,
      windowManager = windowManager!!,
      onCaptureClicked = { captureScreen() },
      onCloseClicked = { stop(this) }
    )
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null || intent.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }

    if (intent.action == ACTION_START) {
      startForegroundServiceWithNotification()

      val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
      val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)

      if (resultCode != 0 && resultData != null) {
        initMediaProjection(resultCode, resultData)
      }

      floatingOverlayView?.show()
      ScreenTranslatorOverlayModule.emitServiceStateChanged(true)
    }

    return START_STICKY
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "漫画屏幕实时翻译服务",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "运行悬浮窗与后台截屏服务"
        setShowBadge(false)
      }
      val manager = getSystemService(NotificationManager::class.java)
      manager?.createNotificationChannel(channel)
    }
  }

  private fun startForegroundServiceWithNotification() {
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      packageManager.getLaunchIntentForPackage(packageName),
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    )

    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("漫画屏幕翻译正在运行")
      .setContentText("轻触第三方应用上的浮标即可截屏翻译")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  @SuppressLint("WrongConstant")
  private fun initMediaProjection(resultCode: Int, resultData: Intent) {
    try {
      mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, resultData)
      mediaProjection?.registerCallback(object : MediaProjection.Callback() {
        override fun onStop() {
          teardown()
        }
      }, mainHandler)

      // 使用 RGBA_8888 格式创建 ImageReader
      imageReader = ImageReader.newInstance(
        screenWidth,
        screenHeight,
        PixelFormat.RGBA_8888,
        2
      )

      virtualDisplay = mediaProjection?.createVirtualDisplay(
        "ScreenTranslatorDisplay",
        screenWidth,
        screenHeight,
        screenDensity,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        imageReader?.surface,
        null,
        mainHandler
      )
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  fun captureScreen() {
    if (isCapturing) return
    isCapturing = true

    floatingOverlayView?.setBallState("截屏中...", true)
    // 隐藏悬浮球，防止被截图录入
    floatingOverlayView?.setBallVisibility(false)

    // 延迟 50ms 确保 WindowManager 刷新移除悬浮球画面
    mainHandler.postDelayed({
      processImageCapture()
    }, 50)
  }

  private fun processImageCapture() {
    try {
      val image: Image? = imageReader?.acquireLatestImage()
      if (image == null) {
        // 若没有拿到最新帧，尝试重试一次
        mainHandler.postDelayed({
          val retryImage = imageReader?.acquireLatestImage()
          if (retryImage != null) {
            handleImage(retryImage)
          } else {
            finishCapture(null, 0, 0)
          }
        }, 100)
        return
      }

      handleImage(image)
    } catch (e: Exception) {
      e.printStackTrace()
      finishCapture(null, 0, 0)
    }
  }

  private fun handleImage(image: Image) {
    try {
      val planes = image.planes
      val buffer = planes[0].buffer
      val pixelStride = planes[0].pixelStride
      val rowStride = planes[0].rowStride
      val rowPadding = rowStride - pixelStride * screenWidth

      val rawBitmap = Bitmap.createBitmap(
        screenWidth + rowPadding / pixelStride,
        screenHeight,
        Bitmap.Config.ARGB_8888
      )
      rawBitmap.copyPixelsFromBuffer(buffer)
      image.close()

      val croppedBitmap = if (rowPadding > 0) {
        Bitmap.createBitmap(rawBitmap, 0, 0, screenWidth, screenHeight)
      } else {
        rawBitmap
      }

      val outputFile = File(cacheDir, "screen_trans_${System.currentTimeMillis()}.jpg")
      val fos = FileOutputStream(outputFile)
      croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 92, fos)
      fos.flush()
      fos.close()

      // 端侧 Google ML Kit 离线文字定位与气泡聚类 (30~50ms，极速 0 成本)
      CoroutineScope(Dispatchers.Default).launch {
        val detectedBubbles = try {
          MangaOcrProcessor.processImage(croppedBitmap)
        } catch (e: Exception) {
          e.printStackTrace()
          emptyList()
        }
        finishCapture(outputFile.absolutePath, screenWidth, screenHeight, detectedBubbles)
      }
    } catch (e: Exception) {
      e.printStackTrace()
      finishCapture(null, 0, 0, emptyList())
    }
  }

  private fun finishCapture(
    filePath: String?,
    width: Int,
    height: Int,
    detectedBubbles: List<Map<String, Any>> = emptyList()
  ) {
    mainHandler.post {
      floatingOverlayView?.setBallVisibility(true)
      floatingOverlayView?.setBallState("识别完成", false)
      isCapturing = false

      if (filePath != null) {
        // 通知 React Native 端截屏与端侧气泡定位就绪，交由大模型批量翻译
        ScreenTranslatorOverlayModule.emitScreenCaptured(filePath, width, height, detectedBubbles)
      }
    }
  }

  fun updateTranslation(bubblesJson: String) {
    mainHandler.post {
      floatingOverlayView?.setBallState("完成", false)
      floatingOverlayView?.showTranslationResultCard(bubblesJson)
    }
  }

  private fun teardown() {
    virtualDisplay?.release()
    virtualDisplay = null
    imageReader?.close()
    imageReader = null
    mediaProjection?.stop()
    mediaProjection = null
    floatingOverlayView?.hide()
    floatingOverlayView = null
    ScreenTranslatorOverlayModule.emitServiceStateChanged(false)
  }

  override fun onDestroy() {
    teardown()
    currentService = null
    super.onDestroy()
  }
}
