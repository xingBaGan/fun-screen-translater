package expo.modules.screentranslator

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject

@SuppressLint("ClickableViewAccessibility")
class FloatingOverlayView(
  private val context: Context,
  private val windowManager: WindowManager,
  private val onCaptureClicked: () -> Unit,
  private val onCloseClicked: () -> Unit
) {

  private val windowType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
  } else {
    @Suppress("DEPRECATION")
    WindowManager.LayoutParams.TYPE_PHONE
  }

  // 悬浮球 View
  private val ballView: FrameLayout = FrameLayout(context)
  private val ballText: TextView = TextView(context)
  private val ballParams: WindowManager.LayoutParams

  // 悬浮翻译卡片 View
  private val cardView: FrameLayout = FrameLayout(context)
  private val cardContentLayout: LinearLayout = LinearLayout(context)
  private val cardParams: WindowManager.LayoutParams
  private var isCardVisible = false

  // 全屏气泡原地覆盖层
  private val inpaintOverlayView: FrameLayout = FrameLayout(context)
  private val inpaintParams: WindowManager.LayoutParams
  private var isInpaintOverlayVisible = false

  private var screenWidth: Int
  private var screenHeight: Int
  private var edgeAnimator: ValueAnimator? = null

  private fun getRealScreenWidth(): Int = context.resources.displayMetrics.widthPixels
  private fun getRealScreenHeight(): Int = context.resources.displayMetrics.heightPixels

  init {
    val displayMetrics = context.resources.displayMetrics
    screenWidth = displayMetrics.widthPixels
    screenHeight = displayMetrics.heightPixels

    val ballSize = dpToPx(56f)

    // 1. 初始化悬浮球参数
    ballParams = WindowManager.LayoutParams(
      ballSize,
      ballSize,
      windowType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = screenWidth - ballSize - dpToPx(16f)
      y = screenHeight / 3
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
    }

    setupBallView(ballSize)

    // 2. 初始化悬浮结果卡片参数
    val cardWidth = (screenWidth * 0.85).toInt()
    val cardMaxHeight = (screenHeight * 0.5).toInt()
    cardParams = WindowManager.LayoutParams(
      cardWidth,
      WindowManager.LayoutParams.WRAP_CONTENT,
      windowType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.CENTER_HORIZONTAL or Gravity.TOP
      y = screenHeight / 4
    }

    setupCardView(cardMaxHeight)

    // 3. 初始化全屏气泡覆盖层参数
    inpaintParams = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      windowType,
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
    }
  }

  private fun setupBallView(ballSize: Int) {
    val bgDrawable = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      colors = intArrayOf(Color.parseColor("#4F46E5"), Color.parseColor("#06B6D4"))
      orientation = GradientDrawable.Orientation.TL_BR
      setStroke(dpToPx(2f), Color.parseColor("#FFFFFF"))
    }
    ballView.background = bgDrawable
    ballView.elevation = dpToPx(8f).toFloat()

    ballText.text = "译"
    ballText.setTextColor(Color.WHITE)
    ballText.textSize = 20f
    ballText.typeface = Typeface.DEFAULT_BOLD
    ballText.gravity = Gravity.CENTER

    val textParams = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT
    )
    ballView.addView(ballText, textParams)

    var initialX = 0
    var initialY = 0
    var initialTouchX = 0f
    var initialTouchY = 0f
    var isDragging = false
    val touchSlop = dpToPx(6f)

    ballView.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          edgeAnimator?.cancel()
          initialX = ballParams.x
          initialY = ballParams.y
          initialTouchX = event.rawX
          initialTouchY = event.rawY
          isDragging = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - initialTouchX
          val dy = event.rawY - initialTouchY
          if (isDragging || Math.hypot(dx.toDouble(), dy.toDouble()) > touchSlop) {
            isDragging = true
            val curWidth = getRealScreenWidth()
            val curHeight = getRealScreenHeight()
            ballParams.x = (initialX + dx).toInt().coerceIn(0, curWidth - ballSize)
            ballParams.y = (initialY + dy).toInt().coerceIn(0, curHeight - ballSize)
            try {
              windowManager.updateViewLayout(ballView, ballParams)
            } catch (e: Exception) {}
          }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          if (!isDragging) {
            // 点击事件：触发截屏翻译
            onCaptureClicked()
          } else {
            // 拖拽松开：自动平滑吸附到屏幕最近边缘（左或右）
            snapToEdge(ballParams.x, ballSize)
          }
          true
        }
        else -> false
      }
    }
  }

  private fun snapToEdge(currentX: Int, ballSize: Int) {
    edgeAnimator?.cancel()
    val curWidth = getRealScreenWidth()
    val targetX = if (currentX + ballSize / 2 < curWidth / 2) {
      dpToPx(8f)
    } else {
      curWidth - ballSize - dpToPx(8f)
    }

    edgeAnimator = ValueAnimator.ofInt(currentX, targetX).apply {
      duration = 200
      addUpdateListener { animation ->
        ballParams.x = animation.animatedValue as Int
        try {
          windowManager.updateViewLayout(ballView, ballParams)
        } catch (e: Exception) {}
      }
      start()
    }
  }

  private fun setupCardView(maxHeight: Int) {
    val cardBg = GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dpToPx(16f).toFloat()
      setColor(Color.parseColor("#F10F172A")) // 深色毛玻璃质感底色
      setStroke(dpToPx(1.5f), Color.parseColor("#334155"))
    }
    cardView.background = cardBg
    cardView.setPadding(dpToPx(16f), dpToPx(16f), dpToPx(16f), dpToPx(16f))

    cardContentLayout.orientation = LinearLayout.VERTICAL
    cardView.addView(cardContentLayout, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.WRAP_CONTENT
    ))
  }

  fun show() {
    try {
      if (ballView.windowToken == null) {
        windowManager.addView(ballView, ballParams)
      }
    } catch (e: Exception) {}
  }

  fun hide() {
    try {
      if (ballView.windowToken != null) {
        windowManager.removeView(ballView)
      }
      dismissCard()
      dismissInpaintOverlay()
    } catch (e: Exception) {}
  }

  fun setBallVisibility(visible: Boolean) {
    ballView.visibility = if (visible) View.VISIBLE else View.INVISIBLE
  }

  fun setBallState(statusText: String, isProcessing: Boolean) {
    ballText.post {
      ballText.text = if (isProcessing) "⏳" else "译"
      val bg = ballView.background as? GradientDrawable
      if (isProcessing) {
        bg?.colors = intArrayOf(Color.parseColor("#F59E0B"), Color.parseColor("#EF4444"))
      } else {
        bg?.colors = intArrayOf(Color.parseColor("#4F46E5"), Color.parseColor("#06B6D4"))
      }
    }
  }

  fun showTranslationResultCard(bubblesJson: String) {
    cardView.post {
      try {
        cardContentLayout.removeAllViews()

        // 标题栏与关闭按钮
        val header = LinearLayout(context).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
        }

        val title = TextView(context).apply {
          text = "✨ 屏幕漫画实时翻译"
          setTextColor(Color.WHITE)
          textSize = 16f
          typeface = Typeface.DEFAULT_BOLD
          layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val btnClose = TextView(context).apply {
          text = "✕"
          setTextColor(Color.parseColor("#94A3B8"))
          textSize = 18f
          setPadding(dpToPx(8f), dpToPx(4f), dpToPx(8f), dpToPx(4f))
          setOnClickListener { dismissCard() }
        }

        header.addView(title)
        header.addView(btnClose)
        cardContentLayout.addView(header)

        // 气泡列表滚动视图
        val scrollView = ScrollView(context).apply {
          layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dpToPx(240f)
          )
        }

        val listContainer = LinearLayout(context).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(0, dpToPx(8f), 0, dpToPx(8f))
        }

        val bubbles = JSONArray(bubblesJson)
        if (bubbles.length() == 0) {
          val emptyText = TextView(context).apply {
            text = "未在当前屏幕检测到日漫对白文字，轻触悬浮球可重新截屏识别。"
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 14f
            setPadding(0, dpToPx(16f), 0, dpToPx(16f))
          }
          listContainer.addView(emptyText)
        } else {
          for (i in 0 until bubbles.length()) {
            val item = bubbles.getJSONObject(i)
            val bubbleItemView = createBubbleItemView(i + 1, item)
            listContainer.addView(bubbleItemView)
          }
        }

        scrollView.addView(listContainer)
        cardContentLayout.addView(scrollView)

        // 底部工具栏
        val footer = LinearLayout(context).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.END
          setPadding(0, dpToPx(8f), 0, 0)
        }

        val btnRetake = TextView(context).apply {
          text = "📸 重新截屏"
          setTextColor(Color.parseColor("#38BDF8"))
          textSize = 13f
          setPadding(dpToPx(12f), dpToPx(6f), dpToPx(12f), dpToPx(6f))
          setOnClickListener {
            dismissCard()
            onCaptureClicked()
          }
        }

        val btnInpaint = TextView(context).apply {
          text = "🔲 原位覆盖模式"
          setTextColor(Color.parseColor("#34D399"))
          textSize = 13f
          setPadding(dpToPx(12f), dpToPx(6f), dpToPx(12f), dpToPx(6f))
          setOnClickListener {
            dismissCard()
            renderInpaintOverlay(bubblesJson)
          }
        }

        footer.addView(btnRetake)
        footer.addView(btnInpaint)
        cardContentLayout.addView(footer)

        // 显示卡片
        if (!isCardVisible) {
          if (cardView.windowToken == null) {
            windowManager.addView(cardView, cardParams)
          }
          isCardVisible = true
        } else {
          windowManager.updateViewLayout(cardView, cardParams)
        }
      } catch (e: Exception) {}
    }
  }

  private fun createBubbleItemView(index: Int, bubble: JSONObject): View {
    val container = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dpToPx(10f), dpToPx(8f), dpToPx(10f), dpToPx(8f))
      val bg = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dpToPx(8f).toFloat()
        setColor(Color.parseColor("#1E293B"))
      }
      background = bg
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
      lp.bottomMargin = dpToPx(8f)
      layoutParams = lp
    }

    val source = bubble.optString("sourceText", "")
    val target = bubble.optString("targetText", "")

    val tvSource = TextView(context).apply {
      text = "[$index] 原文: $source"
      setTextColor(Color.parseColor("#94A3B8"))
      textSize = 12f
    }

    val tvTarget = TextView(context).apply {
      text = "译文: $target"
      setTextColor(Color.parseColor("#F8FAFC"))
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      setPadding(0, dpToPx(4f), 0, 0)
    }

    container.addView(tvSource)
    container.addView(tvTarget)
    return container
  }

  fun renderInpaintOverlay(bubblesJson: String) {
    inpaintOverlayView.post {
      try {
        inpaintOverlayView.removeAllViews()

        // 顶部退出全屏遮罩提示条
        val tipBar = TextView(context).apply {
          text = "已启用屏幕原位气泡覆盖 (点击任意处收起)"
          setTextColor(Color.WHITE)
          textSize = 12f
          gravity = Gravity.CENTER
          setBackgroundColor(Color.parseColor("#CC0F172A"))
          setPadding(0, dpToPx(6f), 0, dpToPx(6f))
          layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
          ).apply { gravity = Gravity.TOP }
        }
        inpaintOverlayView.addView(tipBar)

        val bubbles = JSONArray(bubblesJson)
        for (i in 0 until bubbles.length()) {
          val item = bubbles.getJSONObject(i)
          val box = item.optJSONObject("box") ?: continue
          val x = box.optInt("x", 0)
          val y = box.optInt("y", 0)
          val width = box.optInt("width", 100)
          val height = box.optInt("height", 60)
          val targetText = item.optString("targetText", "")
          val bgColor = item.optString("detectedBgColor", "#FFFFFF")
          val textColor = item.optString("detectedTextColor", "#0F172A")

          // 原位气泡底色消字层 + 译文字体层 (半透明融合，自适应字号)
          val bubbleOverlay = TextView(context).apply {
            text = targetText
            setTextColor(try { Color.parseColor(textColor) } catch (e: Exception) { Color.parseColor("#18181B") })
            gravity = Gravity.CENTER
            includeFontPadding = false

            // 自适应字号估算，防止文字溢出或截断
            val charCount = kotlin.math.max(1, targetText.length)
            val padH = dpToPx(3f)
            val padV = dpToPx(2f)
            val availW = kotlin.math.max(8, width - padH * 2)
            val availH = kotlin.math.max(8, height - padV * 2)
            var bestSizeSp = 9f
            for (s in 16 downTo 6) {
              val charsPerLine = kotlin.math.max(1, (availW / (s * 1.35f)).toInt())
              val lines = (charCount + charsPerLine - 1) / charsPerLine
              val totalH = lines * (s * 1.55f)
              if (totalH <= availH) {
                bestSizeSp = s.toFloat()
                break
              }
            }
            textSize = bestSizeSp

            // 具有微润透明度的底色，自然融入漫画原画 (无生硬灰色边框与阴影)
            val baseBgColor = try { Color.parseColor(bgColor) } catch (e: Exception) { Color.WHITE }
            val transparentBgColor = Color.argb(
              224, // ~88% opacity
              Color.red(baseBgColor),
              Color.green(baseBgColor),
              Color.blue(baseBgColor)
            )

            val bg = GradientDrawable().apply {
              shape = GradientDrawable.RECTANGLE
              cornerRadius = dpToPx(kotlin.math.min(8f, kotlin.math.min(width, height) * 0.22f)).toFloat()
              setColor(transparentBgColor)
            }
            background = bg
            setPadding(padH, padV, padH, padV)
            layoutParams = FrameLayout.LayoutParams(width, height).apply {
              leftMargin = x
              topMargin = y
            }
          }
          inpaintOverlayView.addView(bubbleOverlay)
        }

        inpaintOverlayView.setOnClickListener {
          dismissInpaintOverlay()
        }

        if (!isInpaintOverlayVisible) {
          if (inpaintOverlayView.windowToken == null) {
            windowManager.addView(inpaintOverlayView, inpaintParams)
          }
          isInpaintOverlayVisible = true
        }
      } catch (e: Exception) {}
    }
  }

  fun dismissCard() {
    try {
      if (isCardVisible && cardView.windowToken != null) {
        windowManager.removeView(cardView)
        isCardVisible = false
      }
    } catch (e: Exception) {}
  }

  fun dismissInpaintOverlay() {
    try {
      if (isInpaintOverlayVisible && inpaintOverlayView.windowToken != null) {
        windowManager.removeView(inpaintOverlayView)
        isInpaintOverlayVisible = false
      }
    } catch (e: Exception) {}
  }

  private fun dpToPx(dp: Float): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      dp,
      context.resources.displayMetrics
    ).toInt()
  }
}
