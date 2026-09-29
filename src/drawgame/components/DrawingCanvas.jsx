import React, { useRef, useEffect } from 'react'

export default function DrawingCanvas({ color, size, isDrawer, onStroke, strokesToRender, clearTrigger }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  
  const isDrawing = useRef(false)
  const currentPath = useRef([])
  const lastPos = useRef(null)

  // Resize canvas to match container exactly with devicePixelRatio
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
      
      const ctx = cvs.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
    
    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const drawSegment = (ctx, start, end, c, s) => {
    ctx.strokeStyle = c
    ctx.lineWidth = s
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }

  // Handle incoming strokes (both initial load and new ones)
  useEffect(() => {
    if (!strokesToRender || strokesToRender.length === 0) return
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    const rect = cvs.getBoundingClientRect()

    strokesToRender.forEach(stroke => {
      if (stroke.points.length === 0) return
      const w = rect.width
      const h = rect.height
      let start = { x: stroke.points[0].x * w, y: stroke.points[0].y * h }
      for (let i = 1; i < stroke.points.length; i++) {
        let end = { x: stroke.points[i].x * w, y: stroke.points[i].y * h }
        drawSegment(ctx, start, end, stroke.color, stroke.size)
        start = end
      }
    })
  }, [strokesToRender])

  // Clear canvas handler
  useEffect(() => {
    if (clearTrigger === 0) return
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cvs.width, cvs.height)
    ctx.restore()
  }, [clearTrigger])

  const getPos = (e) => {
    const cvs = canvasRef.current
    const rect = cvs.getBoundingClientRect()
    let clientX, clientY
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: (clientX - rect.left), // normalized later for broadcast
      y: (clientY - rect.top)
    }
  }

  const handleStart = (e) => {
    if (!isDrawer) return
    if (e.cancelable) e.preventDefault() // Prevent scrolling
    isDrawing.current = true
    const pos = getPos(e)
    lastPos.current = pos
    
    const cvs = canvasRef.current
    const rect = cvs.getBoundingClientRect()
    const nx = pos.x / rect.width
    const ny = pos.y / rect.height
    
    currentPath.current = [{ x: nx, y: ny }]
    
    const ctx = cvs.getContext('2d')
    drawSegment(ctx, pos, pos, color, size)
  }

  const handleMove = (e) => {
    if (!isDrawing.current || !isDrawer) return
    if (e.cancelable) e.preventDefault()
    
    const pos = getPos(e)
    const cvs = canvasRef.current
    const ctx = cvs.getContext('2d')
    
    drawSegment(ctx, lastPos.current, pos, color, size)
    lastPos.current = pos
    
    const rect = cvs.getBoundingClientRect()
    currentPath.current.push({ x: pos.x / rect.width, y: pos.y / rect.height })
  }

  const handleEnd = () => {
    if (!isDrawing.current || !isDrawer) return
    isDrawing.current = false
    
    if (currentPath.current.length > 0 && onStroke) {
      onStroke({
        color,
        size,
        points: currentPath.current
      })
    }
    currentPath.current = []
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', touchAction: 'none' }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseOut={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      />
    </div>
  )
}
