package expo.modules.screentranslator

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.Rect
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * 漫画端侧多尺度全场景文字识别处理器
 * 融合借鉴 comic-translate 与 overlay-translator 的核心技术方案：
 * 1. 尺度规划 (Target Short Side >= 1200)：放大检测小文字、小气泡、音效 (如 ポフッ)、注音假名。
 * 2. 反相预处理 (Invert Pass)：颠倒深浅色彩，专门攻克黑底白字标语 (如 淫猥母子新シリーズご開帳♥) 与反白台词。
 * 3. 宏观缩小扫描 (Macro Downscale Pass)：将巨幅艺术封面标题 (如 訪問姦誘) 缩放到 OCR 模型感受野 (40~55px)。
 * 4. 高反差去色扫描 (High-Contrast Pass)：突破复杂插画、彩色特效字 (如 ガッ) 的低对比度限制。
 * 5. 跨气泡黑边阻断与精细化聚类 (Border-Aware Regrouping)：严格禁止跨气泡合并，确保相邻的三个独立气泡细致化展示为三个独立点！
 */
object MangaOcrProcessor {

  private val japaneseRecognizer: TextRecognizer by lazy {
    TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
  }

  private val chineseRecognizer: TextRecognizer by lazy {
    TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
  }

  private val latinRecognizer: TextRecognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  private val koreanRecognizer: TextRecognizer by lazy {
    TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
  }

  private fun getRecognizer(lang: String): TextRecognizer {
    return when (lang.lowercase()) {
      "zh", "chinese" -> chineseRecognizer
      "en", "latin" -> latinRecognizer
      "ko", "korean" -> koreanRecognizer
      else -> japaneseRecognizer // 默认日漫
    }
  }

  data class TextLineItem(
    val text: String,
    val rect: Rect,
    val isVertical: Boolean,
    val charSize: Float
  )

  /**
   * 异步多尺度识别 Bitmap 中的全量文字
   */
  suspend fun processImage(
    bitmap: Bitmap,
    lang: String = "ja"
  ): List<Map<String, Any>> {
    val recognizer = getRecognizer(lang)
    val allDetectedLines = mutableListOf<TextLineItem>()

    // 1. 基准尺度扫描 (1.0x)
    val baseLines = recognizeSingleBitmap(recognizer, bitmap, 1.0f, 1.0f)
    allDetectedLines.addAll(baseLines)

    // 2. 自适应放大扫描 (Upscale Pass - 借鉴 overlay-translator 的 TARGET_SHORT_SIDE = 1200 规范)
    // 解决手机截图/相册中小音效 (如 ポフッ) 单字常低于 20px、笔画无法辨识的问题
    val shortSide = min(bitmap.width, bitmap.height)
    if (shortSide < 1200) {
      val upscaleFactor = min(2.5f, max(1.4f, 1300f / shortSide))
      val upW = (bitmap.width * upscaleFactor).toInt()
      val upH = (bitmap.height * upscaleFactor).toInt()
      var upscaledBitmap: Bitmap? = null
      try {
        upscaledBitmap = Bitmap.createScaledBitmap(bitmap, upW, upH, true)
        val upscaledLines = recognizeSingleBitmap(recognizer, upscaledBitmap, upscaleFactor, upscaleFactor)
        allDetectedLines.addAll(upscaledLines)
      } catch (e: Exception) {
      } finally {
        upscaledBitmap?.recycle()
      }
    }

    // 3. 色彩反相扫描 (Invert Pass - 借鉴 overlay-translator 的 settings_preprocess_invert)
    // 专门捕获黑底白字标语 (如 淫猥母子新シリーズご開帳♥)、深色框反相文字
    var invertedBitmap: Bitmap? = null
    try {
      invertedBitmap = createInvertedBitmap(bitmap)
      val invertedLines = recognizeSingleBitmap(recognizer, invertedBitmap, 1.0f, 1.0f)
      allDetectedLines.addAll(invertedLines)
    } catch (e: Exception) {
    } finally {
      invertedBitmap?.recycle()
    }

    // 4. 针对巨型封面艺术标题的宏观缩小扫描 (Macro Downscale Pass: 压缩到 540px 宽度)
    // 封面大标题 (如 訪問姦誘) 字号高达 150~250px，超出普通文字感受野；缩小到 540px 后字号落在 40~55px 黄金识别区
    if (bitmap.width >= 540 && bitmap.height >= 700) {
      val downscaleFactor = max(0.36f, min(0.65f, 540f / bitmap.width))
      val downW = (bitmap.width * downscaleFactor).toInt()
      val downH = (bitmap.height * downscaleFactor).toInt()
      var downscaledBitmap: Bitmap? = null
      try {
        downscaledBitmap = Bitmap.createScaledBitmap(bitmap, downW, downH, true)
        val downscaledLines = recognizeSingleBitmap(recognizer, downscaledBitmap, downscaleFactor, downscaleFactor)
        allDetectedLines.addAll(downscaledLines)
      } catch (e: Exception) {
      } finally {
        downscaledBitmap?.recycle()
      }
    }

    // 5. 针对彩色/弱对比度特效字的高反差扫描 (High-Contrast Pass)
    // 增强特效字 (如 ガッ) 与复杂背景的笔画反差
    var contrastBitmap: Bitmap? = null
    try {
      contrastBitmap = createHighContrastBitmap(bitmap)
      val contrastLines = recognizeSingleBitmap(recognizer, contrastBitmap, 1.0f, 1.0f)
      allDetectedLines.addAll(contrastLines)
    } catch (e: Exception) {
    } finally {
      contrastBitmap?.recycle()
    }

    // 6. Otsu 自适应二值化扫描 (Binarization Pass - 借鉴 overlay-translator 的 settings_preprocess_binarize)
    // 专门消除复杂渐变背景与发光特效，将艺术大字笔画转换为实心黑白图，大幅提升变形封面标题与音效检出率
    var binarizedBitmap: Bitmap? = null
    try {
      binarizedBitmap = createOtsuBinarizedBitmap(bitmap)
      val binarizedLines = recognizeSingleBitmap(recognizer, binarizedBitmap, 1.0f, 1.0f)
      allDetectedLines.addAll(binarizedLines)
    } catch (e: Exception) {
    } finally {
      binarizedBitmap?.recycle()
    }

    // 7. 跨尺度去重融合 (IoU / Overlap Deduplication)
    val deduplicatedLines = deduplicateLines(allDetectedLines)

    // 8. 边界感知 (Border-Aware) 独立气泡聚类与细致化重构
    return clusterAndFormatBubbles(deduplicatedLines, bitmap)
  }

  /**
   * 单个尺度 Bitmap 的文字识别，并将边界框安全映射回原图坐标空间
   */
  private suspend fun recognizeSingleBitmap(
    recognizer: TextRecognizer,
    bitmap: Bitmap,
    scaleX: Float,
    scaleY: Float
  ): List<TextLineItem> = suspendCancellableCoroutine { continuation ->
    val inputImage = InputImage.fromBitmap(bitmap, 0)

    recognizer.process(inputImage)
      .addOnSuccessListener { visionText ->
        val lines = mutableListOf<TextLineItem>()
        for (block in visionText.textBlocks) {
          if (block.lines.isEmpty()) {
            val blockBox = block.boundingBox ?: continue
            val blockText = block.text.trim()
            if (blockText.isNotEmpty()) {
              val mappedRect = mapRect(blockBox, scaleX, scaleY)
              val isVertical = mappedRect.height() > mappedRect.width() * 1.2f
              val charCount = max(1, blockText.replace(" ", "").length)
              val charSize = if (isVertical) mappedRect.height().toFloat() / charCount else mappedRect.height().toFloat()
              lines.add(TextLineItem(blockText, mappedRect, isVertical, charSize))
            }
            continue
          }

          for (line in block.lines) {
            val box = line.boundingBox ?: block.boundingBox ?: continue
            val text = line.text.trim()
            if (text.isEmpty()) continue

            val mappedRect = mapRect(box, scaleX, scaleY)
            val isVertical = mappedRect.height() > mappedRect.width() * 1.2f
            val charCount = max(1, text.replace(" ", "").length)
            val charSize = if (isVertical) mappedRect.height().toFloat() / charCount else mappedRect.height().toFloat()
            lines.add(TextLineItem(text, mappedRect, isVertical, charSize))
          }
        }
        continuation.resume(lines)
      }
      .addOnFailureListener {
        continuation.resume(emptyList())
      }
  }

  /**
   * 将缩放尺度的 Rect 映射回原图坐标系
   */
  private fun mapRect(rect: Rect, scaleX: Float, scaleY: Float): Rect {
    if (scaleX == 1.0f && scaleY == 1.0f) return rect
    return Rect(
      (rect.left / scaleX).toInt(),
      (rect.top / scaleY).toInt(),
      (rect.right / scaleX).toInt(),
      (rect.bottom / scaleY).toInt()
    )
  }

  /**
   * 创建反相灰度位图 (Invert Preprocessing)
   * 将黑底白字反相为白底黑字，让 ML Kit 能完美识别反白标语与黑底独白
   */
  private fun createInvertedBitmap(src: Bitmap): Bitmap {
    val dest = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(dest)
    val paint = Paint()
    val cm = ColorMatrix(floatArrayOf(
      -1f, 0f, 0f, 0f, 255f,
      0f, -1f, 0f, 0f, 255f,
      0f, 0f, -1f, 0f, 255f,
      0f, 0f, 0f, 1f, 0f
    ))
    paint.colorFilter = ColorMatrixColorFilter(cm)
    canvas.drawBitmap(src, 0f, 0f, paint)
    return dest
  }

  /**
   * 创建高对比度灰度位图，增强弱对比度描边和彩色背景下的文字线条
   */
  private fun createHighContrastBitmap(src: Bitmap): Bitmap {
    val dest = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(dest)
    val paint = Paint()
    val cm = ColorMatrix().apply {
      setSaturation(0f)
      val contrast = 1.55f
      val translate = (-0.5f * contrast + 0.5f) * 255f
      val matrix = floatArrayOf(
        contrast, 0f, 0f, 0f, translate,
        0f, contrast, 0f, 0f, translate,
        0f, 0f, contrast, 0f, translate,
        0f, 0f, 0f, 1f, 0f
      )
      postConcat(ColorMatrix(matrix))
    }
    paint.colorFilter = ColorMatrixColorFilter(cm)
    canvas.drawBitmap(src, 0f, 0f, paint)
    return dest
  }

  /**
   * Otsu 自适应二值化 (借鉴 overlay-translator 的 settings_preprocess_binarize)
   * 消除彩色插画背景、阴影和渐变，将艺术字笔画转换为纯黑白二值图，大幅提升变形艺术标题检出率
   */
  private fun createOtsuBinarizedBitmap(src: Bitmap): Bitmap {
    val width = src.width
    val height = src.height
    val pixels = IntArray(width * height)
    src.getPixels(pixels, 0, width, 0, 0, width, height)

    val histogram = IntArray(256)
    val grays = IntArray(pixels.size)

    for (i in pixels.indices) {
      val c = pixels[i]
      val r = (c shr 16) and 0xFF
      val g = (c shr 8) and 0xFF
      val b = c and 0xFF
      val gray = ((299 * r + 587 * g + 114 * b) / 1000).coerceIn(0, 255)
      grays[i] = gray
      histogram[gray]++
    }

    val total = pixels.size
    var sum = 0f
    for (t in 0..255) sum += t * histogram[t]

    var sumB = 0f
    var wB = 0
    var varMax = 0f
    var threshold = 128

    for (t in 0..255) {
      wB += histogram[t]
      if (wB == 0) continue
      val wF = total - wB
      if (wF == 0) break

      sumB += t.toFloat() * histogram[t]
      val mB = sumB / wB
      val mF = (sum - sumB) / wF

      val varBetween = wB.toFloat() * wF.toFloat() * (mB - mF) * (mB - mF)
      if (varBetween > varMax) {
        varMax = varBetween
        threshold = t
      }
    }

    val dest = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val binPixels = IntArray(pixels.size)
    for (i in pixels.indices) {
      val g = grays[i]
      binPixels[i] = if (g < threshold) Color.BLACK else Color.WHITE
    }
    dest.setPixels(binPixels, 0, width, 0, 0, width, height)
    return dest
  }

  /**
   * 跨尺度去重与融合：保留更精准或包含更多字符的检测结果
   */
  private fun deduplicateLines(lines: List<TextLineItem>): List<TextLineItem> {
    val result = mutableListOf<TextLineItem>()
    for (line in lines) {
      var merged = false
      for (i in result.indices) {
        val existing = result[i]
        val iou = computeIoU(line.rect, existing.rect)
        val inter = computeIntersection(line.rect, existing.rect)
        val minArea = min(line.rect.width() * line.rect.height(), existing.rect.width() * existing.rect.height()).toFloat()
        val overlapRatio = if (minArea > 0f) inter / minArea else 0f

        if (iou > 0.35f || overlapRatio > 0.55f) {
          if (line.text.length > existing.text.length) {
            result[i] = line
          } else {
            val unionRect = Rect(
              min(line.rect.left, existing.rect.left),
              min(line.rect.top, existing.rect.top),
              max(line.rect.right, existing.rect.right),
              max(line.rect.bottom, existing.rect.bottom)
            )
            result[i] = existing.copy(rect = unionRect)
          }
          merged = true
          break
        }
      }
      if (!merged) {
        result.add(line)
      }
    }
    return result
  }

  private fun computeIntersection(a: Rect, b: Rect): Float {
    val left = max(a.left, b.left)
    val top = max(a.top, b.top)
    val right = min(a.right, b.right)
    val bottom = min(a.bottom, b.bottom)
    if (right <= left || bottom <= top) return 0f
    return (right - left) * (bottom - top).toFloat()
  }

  private fun computeIoU(a: Rect, b: Rect): Float {
    val inter = computeIntersection(a, b)
    if (inter <= 0f) return 0f
    val areaA = a.width() * a.height().toFloat()
    val areaB = b.width() * b.height().toFloat()
    val union = areaA + areaB - inter
    return if (union > 0f) inter / union else 0f
  }

  /**
   * 将去重后的全量 TextLines 聚类为独立对话气泡与文本块
   */
  private fun clusterAndFormatBubbles(
    rawLines: List<TextLineItem>,
    bitmap: Bitmap
  ): List<Map<String, Any>> {
    if (rawLines.isEmpty()) {
      return emptyList()
    }

    // 并查集聚合属于同一气泡或段落的文字行 (严格防跨气泡合并)
    val clusters = clusterLines(rawLines, bitmap)

    val resultList = mutableListOf<Map<String, Any>>()
    var indexCounter = 1

    for (cluster in clusters) {
      if (cluster.isEmpty()) continue

      var minX = Int.MAX_VALUE
      var minY = Int.MAX_VALUE
      var maxX = Int.MIN_VALUE
      var maxY = Int.MIN_VALUE

      var isPredominantlyVertical = 0
      var totalCharSize = 0f

      for (item in cluster) {
        minX = min(minX, item.rect.left)
        minY = min(minY, item.rect.top)
        maxX = max(maxX, item.rect.right)
        maxY = max(maxY, item.rect.bottom)
        totalCharSize += item.charSize
        if (item.isVertical) isPredominantlyVertical++
      }

      val isVertical = isPredominantlyVertical >= (cluster.size / 2.0)
      val avgCharSize = totalCharSize / cluster.size

      // 文本拼接逻辑：
      // 竖排：从右往左的列优先，从上到下拼接
      // 横排：从上往下的行优先，从左到右拼接
      val sortedLines = if (isVertical) {
        cluster.sortedWith(compareByDescending<TextLineItem> { it.rect.centerX() }
          .thenBy { it.rect.top })
      } else {
        cluster.sortedWith(compareBy<TextLineItem> { it.rect.top }
          .thenBy { it.rect.left })
      }

      val fullSourceText = sortedLines.joinToString(" ") { it.text }

      // 适度留白与外扩（不宜过大，防止侵入邻近气泡）
      val paddingX = min(8, max(4, ((maxX - minX) * 0.04).toInt()))
      val paddingY = min(8, max(3, ((maxY - minY) * 0.04).toInt()))
      val finalLeft = max(0, minX - paddingX)
      val finalTop = max(0, minY - paddingY)
      val finalWidth = min(bitmap.width - finalLeft, (maxX - minX) + paddingX * 2)
      val finalHeight = min(bitmap.height - finalTop, (maxY - minY) + paddingY * 2)

      val blockRect = Rect(finalLeft, finalTop, finalLeft + finalWidth, finalTop + finalHeight)

      // 采样背景底色与文字颜色
      val colorAnalysis = sampleColorsAndUniformity(bitmap, blockRect)

      // 智能判定文本类型：气泡(bubble)、标题(title)、旁白嵌字(free_text)、拟声词(sfx)
      val textType = classifyTextType(
        text = fullSourceText,
        box = blockRect,
        bitmap = bitmap,
        avgCharSize = avgCharSize,
        luminance = colorAnalysis.luminance,
        isUniform = colorAnalysis.isUniform
      )

      resultList.add(
        mapOf(
          "id" to "b_${indexCounter++}",
          "box" to mapOf(
            "x" to blockRect.left,
            "y" to blockRect.top,
            "width" to blockRect.width(),
            "height" to blockRect.height()
          ),
          "sourceText" to fullSourceText,
          "targetText" to "",
          "direction" to if (isVertical) "vertical" else "horizontal",
          "textType" to textType,
          "detectedBgColor" to colorAnalysis.bgColorHex,
          "detectedTextColor" to colorAnalysis.textColorHex,
          "fontSize" to avgCharSize.toInt()
        )
      )
    }

    // 气泡级 NMS 与高重叠包含融合 (Bubble-Level Deduplication / NMS)
    // 彻底杜绝两个坐标几乎相同的重复气泡/小标 (如 2 和 27)
    return deduplicateBubbleMaps(resultList)
  }

  /**
   * 气泡级 NMS 与包含合并
   */
  private fun deduplicateBubbleMaps(bubbles: List<Map<String, Any>>): List<Map<String, Any>> {
    val result = mutableListOf<MutableMap<String, Any>>()

    for (b in bubbles) {
      val boxMap = b["box"] as? Map<*, *> ?: continue
      val x = (boxMap["x"] as? Number)?.toInt() ?: 0
      val y = (boxMap["y"] as? Number)?.toInt() ?: 0
      val w = (boxMap["width"] as? Number)?.toInt() ?: 0
      val h = (boxMap["height"] as? Number)?.toInt() ?: 0
      val rect = Rect(x, y, x + w, y + h)
      val text = b["sourceText"] as? String ?: ""
      val textType = b["textType"] as? String ?: "bubble"

      var merged = false
      for (i in result.indices) {
        val existing = result[i]
        val eBox = existing["box"] as? Map<*, *> ?: continue
        val ex = (eBox["x"] as? Number)?.toInt() ?: 0
        val ey = (eBox["y"] as? Number)?.toInt() ?: 0
        val ew = (eBox["width"] as? Number)?.toInt() ?: 0
        val eh = (eBox["height"] as? Number)?.toInt() ?: 0
        val eRect = Rect(ex, ey, ex + ew, ey + eh)
        val eText = existing["sourceText"] as? String ?: ""
        val eType = existing["textType"] as? String ?: "bubble"

        val iou = computeIoU(rect, eRect)
        val inter = computeIntersection(rect, eRect)
        val minArea = min(rect.width() * rect.height(), eRect.width() * eRect.height()).toFloat()
        val overlapRatio = if (minArea > 0f) inter / minArea else 0f

        val cDist = Math.hypot((rect.centerX() - eRect.centerX()).toDouble(), (rect.centerY() - eRect.centerY()).toDouble())
        val isVeryClose = cDist < min(rect.width(), eRect.width()) * 0.45

        if (iou > 0.35f || overlapRatio > 0.45f || isVeryClose) {
          val unionRect = Rect(
            min(rect.left, eRect.left),
            min(rect.top, eRect.top),
            max(rect.right, eRect.right),
            max(rect.bottom, eRect.bottom)
          )

          val mergedText = when {
            text.contains(eText) -> text
            eText.contains(text) -> eText
            text.length > eText.length -> text
            else -> eText
          }

          val mergedType = if (textType != "bubble" && eType == "bubble") textType else eType

          existing["box"] = mapOf(
            "x" to unionRect.left,
            "y" to unionRect.top,
            "width" to unionRect.width(),
            "height" to unionRect.height()
          )
          existing["sourceText"] = mergedText
          existing["textType"] = mergedType
          merged = true
          break
        }
      }

      if (!merged) {
        result.add(b.toMutableMap())
      }
    }

    return result.mapIndexed { index, map ->
      map["id"] = "b_${index + 1}"
      map
    }
  }

  /**
   * 基于几何距离、字体比例及气泡物理黑边阻断的聚类
   */
  private fun clusterLines(lines: List<TextLineItem>, bitmap: Bitmap): List<List<TextLineItem>> {
    val parent = IntArray(lines.size) { it }

    fun find(i: Int): Int {
      var root = i
      while (root != parent[root]) {
        root = parent[root]
      }
      var curr = i
      while (curr != root) {
        val nxt = parent[curr]
        parent[curr] = root
        curr = nxt
      }
      return root
    }

    fun union(i: Int, j: Int) {
      val rootI = find(i)
      val rootJ = find(j)
      if (rootI != rootJ) {
        parent[rootI] = rootJ
      }
    }

    for (i in lines.indices) {
      for (j in i + 1 until lines.size) {
        if (shouldMergeLines(lines[i], lines[j], bitmap)) {
          union(i, j)
        }
      }
    }

    val clusterMap = mutableMapOf<Int, MutableList<TextLineItem>>()
    for (i in lines.indices) {
      val root = find(i)
      clusterMap.getOrPut(root) { mutableListOf() }.add(lines[i])
    }

    return clusterMap.values.toList()
  }

  /**
   * 跨气泡边界检测 (借鉴 overlay-translator 与 comic-translate)：
   * 检查两列文字之间是否跨越了气泡黑色边框或插画背景。
   * 同一气泡内的文字列之间只有纯白色/浅色背景；如果两列之间存在深色黑边，证明属于不同气泡，严禁合并！
   */
  private fun isSeparatedByBorder(bitmap: Bitmap, ra: Rect, rb: Rect): Boolean {
    val x1 = min(ra.right, rb.left)
    val x2 = max(ra.right, rb.left)
    if (x2 - x1 < 2) return false // 相交或紧密贴合

    val yTop = max(ra.top, rb.top)
    val yBottom = min(ra.bottom, rb.bottom)
    if (yBottom <= yTop) return true // 垂直方向无投影重叠，不能合并

    // 在垂直重叠区域均匀采样 3 条横向测试线 (25%, 50%, 75%)
    val testYLines = listOf(
      yTop + (yBottom - yTop) / 4,
      (yTop + yBottom) / 2,
      yBottom - (yBottom - yTop) / 4
    )

    for (y in testYLines) {
      if (y !in 0 until bitmap.height) continue
      val step = max(1, (x2 - x1) / 10)
      for (x in x1..x2 step step) {
        if (x !in 0 until bitmap.width) continue
        val pixel = bitmap.getPixel(x, y)
        val r = Color.red(pixel)
        val g = Color.green(pixel)
        val b = Color.blue(pixel)
        val lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
        // 如果中间存在深色描边或插画分界线 (亮度 < 0.45)
        if (lum < 0.45) {
          return true
        }
      }
    }

    return false
  }

  /**
   * 判断两行文字是否属于同一气泡
   */
  private fun shouldMergeLines(a: TextLineItem, b: TextLineItem, bitmap: Bitmap): Boolean {
    val ra = a.rect
    val rb = b.rect

    // 1. 若两者有直接相交重叠，合并
    if (Rect.intersects(ra, rb)) return true

    // 字号比例判定：若字号差异超过 1.8 倍，属于不同层级（如标题与小字、音效与正文），严禁合并
    val maxChar = max(a.charSize, b.charSize)
    val minChar = max(1f, min(a.charSize, b.charSize))
    if (maxChar / minChar > 1.8f) {
      return false
    }

    val isAVertical = a.isVertical || (a.text.length <= 2 && b.isVertical)
    val isBVertical = b.isVertical || (b.text.length <= 2 && a.isVertical)

    // 2. 竖排日漫规则：同一气泡内的多列竖排文本
    if (isAVertical && isBVertical) {
      val xDist = if (ra.right < rb.left) rb.left - ra.right else if (rb.right < ra.left) ra.left - rb.right else 0
      val yOverlap = max(0, min(ra.bottom, rb.bottom) - max(ra.top, rb.top))
      val minH = min(ra.height(), rb.height())
      val maxColWidth = max(ra.width(), rb.width()).toFloat()

      // 严格列间距限制：同一气泡内的列间距通常不超过 1.15 倍列宽，且绝不超过 38px
      val maxAllowedGap = min(38f, maxColWidth * 1.15f)

      // 同一气泡内列的条件：
      // - 间距紧密
      // - 垂直重叠至少达到较短列的 40%
      // - 顶部或底部对齐良好 (绝对差值不超过短列的 45%)
      if (xDist <= maxAllowedGap && yOverlap >= minH * 0.40f && abs(ra.top - rb.top) <= minH * 0.45f) {
        // 关键防护：检查两列之间是否跨越了气泡黑边或插画，若跨越则证明是两个独立气泡！
        if (!isSeparatedByBorder(bitmap, ra, rb)) {
          return true
        }
      }
    }

    // 3. 横排规则：同一气泡/段落内的多行横排文本
    if (!a.isVertical && !b.isVertical) {
      val yDist = if (ra.bottom < rb.top) rb.top - ra.bottom else if (rb.bottom < ra.top) ra.top - rb.bottom else 0
      val xOverlap = max(0, min(ra.right, rb.right) - max(ra.left, rb.left))
      val minW = min(ra.width(), rb.width())
      val maxLineHeight = max(ra.height(), rb.height()).toFloat()

      val maxAllowedGap = min(32f, maxLineHeight * 1.15f)

      if (yDist <= maxAllowedGap && xOverlap >= minW * 0.40f && abs(ra.left - rb.left) <= minW * 0.45f) {
        if (!isSeparatedByBorder(bitmap, ra, rb)) {
          return true
        }
      }
    }

    return false
  }

  data class ColorAnalysis(
    val bgColorHex: String,
    val textColorHex: String,
    val luminance: Double,
    val isUniform: Boolean
  )

  /**
   * 采样文本块背景边缘颜色与方差，确定消字底色与气泡属性
   */
  private fun sampleColorsAndUniformity(bitmap: Bitmap, box: Rect): ColorAnalysis {
    var totalR = 0
    var totalG = 0
    var totalB = 0
    val sampledPixels = mutableListOf<Int>()

    val points = listOf(
      Pair(box.left + 2, box.top + 2),
      Pair(box.right - 2, box.top + 2),
      Pair(box.left + 2, box.bottom - 2),
      Pair(box.right - 2, box.bottom - 2),
      Pair(box.centerX(), box.top + 2),
      Pair(box.centerX(), box.bottom - 2),
      Pair(box.left + 2, box.centerY()),
      Pair(box.right - 2, box.centerY())
    )

    for ((px, py) in points) {
      if (px in 0 until bitmap.width && py in 0 until bitmap.height) {
        val pixel = bitmap.getPixel(px, py)
        sampledPixels.add(pixel)
        totalR += Color.red(pixel)
        totalG += Color.green(pixel)
        totalB += Color.blue(pixel)
      }
    }

    if (sampledPixels.isEmpty()) {
      return ColorAnalysis("#FFFFFF", "#0F172A", 1.0, true)
    }

    val count = sampledPixels.size
    val avgR = totalR / count
    val avgG = totalG / count
    val avgB = totalB / count

    var variance = 0.0
    for (pixel in sampledPixels) {
      val r = Color.red(pixel)
      val g = Color.green(pixel)
      val b = Color.blue(pixel)
      val distSq = (r - avgR) * (r - avgR) + (g - avgG) * (g - avgG) + (b - avgB) * (b - avgB)
      variance += distSq
    }
    val stdDev = sqrt(variance / count)
    val isUniform = stdDev < 42.0

    val luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255.0
    val bgHex = String.format("#%02X%02X%02X", avgR, avgG, avgB)
    val textHex = if (luminance > 0.52) "#0F172A" else "#FFFFFF"

    return ColorAnalysis(bgHex, textHex, luminance, isUniform)
  }

  /**
   * 智能分类文本类型：
   * - bubble: 对话气泡 (白底/亮底单色区域)
   * - title: 大标题/封面书名/章节标题
   * - sfx: 拟声词 (片假名音效)
   * - free_text: 旁白/画面浮动嵌字
   */
  private fun classifyTextType(
    text: String,
    box: Rect,
    bitmap: Bitmap,
    avgCharSize: Float,
    luminance: Double,
    isUniform: Boolean
  ): String {
    val clean = text.replace(" ", "").trim()

    // 1. 标题判断：字号巨大，或单字高度/宽度占整图 > 6%，或文本块宽度 > 35% 且字号 > 26
    val widthRatio = box.width().toFloat() / bitmap.width
    val heightRatio = box.height().toFloat() / bitmap.height
    if (avgCharSize > 34f || widthRatio > 0.38f || (widthRatio > 0.28f && heightRatio > 0.07f)) {
      return "title"
    }

    // 2. 拟声词 (SFX) 判断：短字符 (<= 6) 且几乎全为片假名或拟声符号
    val isKatakanaSfx = clean.isNotEmpty() && clean.length <= 6 && clean.all { c ->
      (c in '\u30A0'..'\u30FF') || c == 'ッ' || c == 'ー' || c == '！' || c == '!' || c == '…' || c == '?' || c == '？'
    }
    if (isKatakanaSfx && (!isUniform || luminance < 0.70)) {
      return "sfx"
    }

    // 3. 气泡判断：底色均匀且亮度偏高 (常见日漫白底气泡)
    if (isUniform && luminance > 0.68) {
      return "bubble"
    }

    // 4. 其它一律作为画面嵌字/旁白处理 (free_text)
    return "free_text"
  }
}
