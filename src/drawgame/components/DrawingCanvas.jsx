import React, { useRef, useEffect, forwardRef, useImperativeHandle, memo } from 'react'

const DrawingCanvas = forwardRef(({ color, size, tool = 'brush', isDrawer, onStroke, onResize }, ref) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  
  const isDrawing = useRef(false)
  const lastPos = useRef(null)
  const currentStrokeRef = useRef(null)
  const strokeBaseIdRef = useRef(null)
  const chunkIndexRef = useRef(0)
  const strokeSeqRef = useRef(0)

  const hexToRgba = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return [r, g, b, 255]
  }

  const performFloodFill = (ctx, startX, startY, width, height, fillColorHex) => {
    const startXInt = Math.floor(startX)
    const startYInt = Math.floor(startY)
    if (startXInt < 0 || startXInt >= width || startYInt < 0 || startYInt >= height) return
    
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    
    const startIdx = (startYInt * width + startXInt) * 4
    const startR = data[startIdx]
    const startG = data[startIdx + 1]
    const startB = data[startIdx + 2]
    const startA = data[startIdx + 3]
    
    const [fillR, fillG, fillB, fillA] = hexToRgba(fillColorHex)
    
    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) {
      return
    }
    
    const stack = [[startXInt, startYInt]]
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()
      
      let lx = x
      while (lx >= 0) {
        const idx = (y * width + lx) * 4
        if (data[idx] !== startR || data[idx+1] !== startG || data[idx+2] !== startB || data[idx+3] !== startA) {
          break
        }
        lx--
      }
      lx++
      
      let rx = x
      while (rx < width) {
        const idx = (y * width + rx) * 4
        if (data[idx] !== startR || data[idx+1] !== startG || data[idx+2] !== startB || data[idx+3] !== startA) {
          break
        }
        rx++
      }
      rx--
      
      let scanUp = false
      let scanDown = false
      
      for (let cx = lx; cx <= rx; cx++) {
        const idx = (y * width + cx) * 4
        data[idx] = fillR
        data[idx+1] = fillG
        data[idx+2] = fillB
        data[idx+3] = fillA
        
        if (y > 0) {
          const upIdx = ((y - 1) * width + cx) * 4
          const matches = (data[upIdx] === startR && data[upIdx+1] === startG && data[upIdx+2] === startB && data[upIdx+3] === startA)
          if (matches && !scanUp) {
            stack.push([cx, y - 1])
            scanUp = true
          } else if (!matches) {
            scanUp = false
          }
        }
        
        if (y < height - 1) {
          const downIdx = ((y + 1) * width + cx) * 4
          const matches = (data[downIdx] === startR && data[downIdx+1] === startG && data[downIdx+2] === startB && data[downIdx+3] === startA)
          if (matches && !scanDown) {
            stack.push([cx, y + 1])
            scanDown = true
          } else if (!matches) {
            scanDown = false
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
  }

  const drawSegment = (ctx, start, end, c, s, t) => {
    ctx.globalCompositeOperation = t === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = c
    ctx.lineWidth = s
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    if (start.x === end.x && start.y === end.y) {
      ctx.lineTo(end.x + 0.1, end.y)
    } else {
      ctx.lineTo(end.x, end.y)
    }
    ctx.stroke()
  }

  const liveDraw = (stroke) => {
    const cvs = canvasRef.current
    if (!cvs || !stroke || !stroke.points || stroke.points.length === 0) return
    const ctx = cvs.getContext('2d')
    const rect = cvs.getBoundingClientRect()
    
    if (stroke.tool === 'fill') {
      performFloodFill(ctx, stroke.points[0].x * cvs.width, stroke.points[0].y * cvs.height, cvs.width, cvs.height, stroke.color)
      ctx.globalCompositeOperation = 'source-over'
      return
    }
    const isMobile = window.innerWidth <= 768
    const dpr = isMobile ? 1 : (window.devicePixelRatio || 1)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    
    const w = isMobile ? 800 : rect.width
    const h = isMobile ? 600 : rect.height
    let start = { x: stroke.points[0].x * w, y: stroke.points[0].y * h }
    
    if (stroke.points.length === 1) {
      drawSegment(ctx, start, start, stroke.color, stroke.size, stroke.tool)
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        let end = { x: stroke.points[i].x * w, y: stroke.points[i].y * h }
        drawSegment(ctx, start, end, stroke.color, stroke.size, stroke.tool)
        start = end
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  const redrawAll = (strokesToRender) => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    const rect = cvs.getBoundingClientRect()
    
    const isMobile = window.innerWidth <= 768
    const dpr = isMobile ? 1 : (window.devicePixelRatio || 1)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cvs.width, cvs.height)
    ctx.scale(dpr, dpr)

    const renderStroke = (stroke) => {
      if (!stroke || !stroke.points || stroke.points.length === 0) return
      
      if (stroke.tool === 'fill') {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        performFloodFill(ctx, stroke.points[0].x * cvs.width, stroke.points[0].y * cvs.height, cvs.width, cvs.height, stroke.color)
        ctx.scale(dpr, dpr)
        return
      }
      const w = isMobile ? 800 : rect.width
      const h = isMobile ? 600 : rect.height
      let start = { x: stroke.points[0].x * w, y: stroke.points[0].y * h }
      if (stroke.points.length === 1) {
        drawSegment(ctx, start, start, stroke.color, stroke.size, stroke.tool)
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          let end = { x: stroke.points[i].x * w, y: stroke.points[i].y * h }
          drawSegment(ctx, start, end, stroke.color, stroke.size, stroke.tool)
          start = end
        }
      }
    }

    if (strokesToRender) {
      strokesToRender.forEach(renderStroke)
    }

    // Preserve active in-progress local stroke on redraw
    if (currentStrokeRef.current && currentStrokeRef.current.points?.length) {
      renderStroke(currentStrokeRef.current)
    }

    ctx.globalCompositeOperation = 'source-over'
  }

  useImperativeHandle(ref, () => ({
    redrawAll,
    liveDraw,
    clear: () => {
      const cvs = canvasRef.current
      currentStrokeRef.current = null
      isDrawing.current = false
      if (!cvs) return
      const ctx = cvs.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cvs.width, cvs.height)
      ctx.globalCompositeOperation = 'source-over'
    }
  }))

  useEffect(() => {
    const resizeCanvas = () => {
      const cvs = canvasRef.current
      const container = containerRef.current
      if (!cvs || !container) return
      
      const rect = container.getBoundingClientRect()
      const isMobile = window.innerWidth <= 768
      
      let sizeChanged = false
      if (isMobile) {
        if (cvs.width !== 800) {
          cvs.width = 800
          sizeChanged = true
        }
        if (cvs.height !== 600) {
          cvs.height = 600
          sizeChanged = true
        }
        if (cvs.style.width !== '100%') cvs.style.width = '100%'
        if (cvs.style.height !== '100%') cvs.style.height = '100%'
        if (cvs.style.objectFit !== 'fill') cvs.style.objectFit = 'fill'
      } else {
        const dpr = window.devicePixelRatio || 1
        const targetW = Math.round(rect.width * dpr)
        const targetH = Math.round(rect.height * dpr)
        // Only update bitmap dimensions if they genuinely change to prevent clearing canvas bitmap
        if (targetW > 0 && targetH > 0 && (cvs.width !== targetW || cvs.height !== targetH)) {
          cvs.width = targetW
          cvs.height = targetH
          sizeChanged = true
        }
        const styleW = `${rect.width}px`
        const styleH = `${rect.height}px`
        if (cvs.style.width !== styleW) cvs.style.width = styleW
        if (cvs.style.height !== styleH) cvs.style.height = styleH
        if (cvs.style.objectFit !== 'fill') cvs.style.objectFit = 'fill'
      }

      if (sizeChanged) {
        const ctx = cvs.getContext('2d')
        const dpr = isMobile ? 1 : (window.devicePixelRatio || 1)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
        ctx.globalCompositeOperation = 'source-over'
        onResize?.()
      }
    }

    let ro = null
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        resizeCanvas()
      })
      ro.observe(containerRef.current)
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [onResize])

  const getPos = (e) => {
    const cvs = canvasRef.current
    const rect = cvs.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    }
  }

  const handleStart = (e) => {
    if (!isDrawer) return
    const cvs = canvasRef.current
    const rect = cvs.getBoundingClientRect()
    const pos = getPos(e)
    const nx = pos.x / rect.width
    const ny = pos.y / rect.height
    
    if (tool === 'fill') {
      const strokeId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const stroke = { strokeId, color, size, tool, points: [{ x: nx, y: ny }], isComplete: true }
      liveDraw(stroke)
      if (onStroke) onStroke(stroke, true)
      return
    }

    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId)
    isDrawing.current = true
    lastPos.current = pos
    
    strokeBaseIdRef.current = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    chunkIndexRef.current = 0
    strokeSeqRef.current = 0
    const strokeId = `${strokeBaseIdRef.current}-c0`

    const stroke = { strokeId, color, size, tool, points: [{ x: nx, y: ny }] }
    currentStrokeRef.current = stroke
    liveDraw(stroke)
    if (onStroke) onStroke({ ...stroke, seq: strokeSeqRef.current++ }, false)
  }

  const handleMove = (e) => {
    if (!isDrawing.current || !isDrawer || !currentStrokeRef.current) return
    
    const pos = getPos(e)
    const cvs = canvasRef.current
    const rect = cvs.getBoundingClientRect()
    
    const prevNx = lastPos.current.x / rect.width
    const prevNy = lastPos.current.y / rect.height
    const nx = pos.x / rect.width
    const ny = pos.y / rect.height
    
    const point = { x: nx, y: ny }
    currentStrokeRef.current.points.push(point)
    
    const deltaStroke = {
      strokeId: currentStrokeRef.current.strokeId,
      color,
      size,
      tool,
      points: [{ x: prevNx, y: prevNy }, point],
      seq: strokeSeqRef.current++
    }
    liveDraw(deltaStroke)
    lastPos.current = pos
    if (onStroke) onStroke(deltaStroke, false)

    if (currentStrokeRef.current.points.length >= 500) {
      if (onStroke) onStroke({ ...currentStrokeRef.current, isComplete: true }, true)
      chunkIndexRef.current += 1
      const nextStrokeId = `${strokeBaseIdRef.current}-c${chunkIndexRef.current}`
      currentStrokeRef.current = { strokeId: nextStrokeId, color, size, tool, points: [point] }
      if (onStroke) onStroke({ ...currentStrokeRef.current, seq: strokeSeqRef.current++ }, false)
    }
  }

  const handleEnd = (e) => {
    if (!isDrawing.current || !isDrawer) return
    if (e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(e.pointerId) } catch (err) {}
    }
    isDrawing.current = false
    if (onStroke && currentStrokeRef.current) {
      onStroke({ ...currentStrokeRef.current, isComplete: true }, true)
    }
    currentStrokeRef.current = null
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', touchAction: 'none' }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
      />
    </div>
  )
})

export default memo(DrawingCanvas)
