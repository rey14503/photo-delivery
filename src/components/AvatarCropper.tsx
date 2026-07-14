'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImg, type PixelCrop } from '@/lib/cropImage'
import { CloseOutlineIcon } from './PhotoIcons'
import styles from './AvatarCropper.module.css'

export interface AvatarCropperProps {
  imageSrc: string | null
  isOpen: boolean
  onClose: () => void
  onCropComplete: (croppedBlob: Blob) => Promise<void> | void
}

export function AvatarCropper({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setProcessing(false)
    }
  }, [isOpen, imageSrc])

  const onCropCompleteCallback = useCallback((_: unknown, croppedPixels: PixelCrop) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  if (!isOpen || !imageSrc) return null

  const handleApply = async () => {
    if (!croppedAreaPixels) return
    setProcessing(true)
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0)
      await onCropComplete(croppedBlob)
      onClose()
    } catch (err) {
      console.error('Failed to crop image:', err)
    } finally {
      setProcessing(false)
    }
  }

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(1, Math.min(3, newZoom))
    setZoom(Number(clamped.toFixed(2)))
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !processing) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Update profile picture" className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Update profile picture</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Close"
            className={styles.closeBtn}
          >
            <CloseOutlineIcon size={18} />
          </button>
        </div>

        <div className={styles.hintBar}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
          </svg>
          <span>Drag to reposition photo</span>
        </div>

        <div className={styles.cropContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={setZoom}
          />
        </div>

        <div className={styles.controls}>
          <div className={styles.sliderGroup}>
            <button
              type="button"
              disabled={processing || zoom <= 1}
              onClick={() => handleZoomChange(zoom - 0.1)}
              className={styles.zoomBtn}
              aria-label="Zoom out"
            >
              −
            </button>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.02}
              aria-label="Zoom scale"
              disabled={processing}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className={styles.slider}
            />
            <button
              type="button"
              disabled={processing || zoom >= 3}
              onClick={() => handleZoomChange(zoom + 0.1)}
              className={styles.zoomBtn}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            className={styles.cancelBtn}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleApply}
            className={styles.applyBtn}
          >
            {processing ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
