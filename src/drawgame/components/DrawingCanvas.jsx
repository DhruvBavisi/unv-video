import React, { useRef, useEffect, forwardRef, useImperativeHandle, memo } from 'react'

const DrawingCanvas = forwardRef(({ color, size, tool = 'brush', isDrawer, onStroke }, ref) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  
  const isDrawing = useRef(false)
  const lastPos = useRef(null)

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
    
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    
    const w = rect.width
    const h = rect.height
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

  const redrawAll = (strokesToRender) => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    const rect = cvs.getBoundingClientRect()
    
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cvs.width, cvs.height)
    ctx.scale(dpr, dpr)

    if (strokesToRender) {
      strokesToRender.forEach(stroke => {
        if (!stroke.points || stroke.points.length === 0) return
        const w = rect.width
        const h = rect.height
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
      })
    }
  }

  useImperativeHandle(ref, () => ({
    redrawAll,
    liveDraw,
    clear: () => {
      const cvs = canvasRef.current
      if (!cvs) return
      const ctx = cvs.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cvs.width, cvs.height)
    }
  }))

  useEffect(() => {
    const resizeCanvas = () => {
      const cvs = canvasRef.current
      const container = containerRef.current
      if (!cvs || !container) return
      
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      cvs.width = rect.width * dpr
      cvs.height = rect.height * dpr
      cvs.style.width = `${rect.width}px`
      cvs.style.height = `${rect.height}px`
    }
    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const getPos = (e) => {
    const cvs = canvasRef.current
    const rect = cvs.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    }
  }

  const currentStrokeRef = useRef(null)

  const handleStart = (e) => {
    if (!isDrawer) return
    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId)
    isDrawing.current = true
    const pos = getPos(e)
    lastPos.current = pos
    
    const cvs = canvasRef.current
    const rect = cvs.getBoundingClientRect()
    const nx = pos.x / rect.width
    const ny = pos.y / rect.height
    
    const stroke = { color, size, tool, points: [{ x: nx, y: ny }] }
    currentStrokeRef.current = stroke
    liveDraw(stroke)
    if (onStroke) onStroke(stroke, false)
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
    
    const deltaStroke = { color, size, tool, points: [{ x: prevNx, y: prevNy }, point] }
    liveDraw(deltaStroke)
    lastPos.current = pos
    if (onStroke) onStroke(deltaStroke, false)

    if (currentStrokeRef.current.points.length >= 500) {
      if (onStroke) onStroke(currentStrokeRef.current, true)
      currentStrokeRef.current = { color, size, tool, points: [point] }
    }
  }

  const handleEnd = (e) => {
    if (!isDrawing.current || !isDrawer) return
    if (e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(e.pointerId) } catch (err) {}
    }
    isDrawing.current = false
    if (onStroke && currentStrokeRef.current) {
      onStroke(currentStrokeRef.current, true)
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
