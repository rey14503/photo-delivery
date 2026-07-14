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
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
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
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation)
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
      <div role="dialog" aria-modal="true" aria-label="Adjust & Crop Avatar" className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Adjust & Crop Avatar</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Close cropper"
            className={styles.closeBtn}
          >
            <CloseOutlineIcon size={16} />
          </button>
        </div>

        <div className={styles.cropContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={true}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={setZoom}
          />
        </div>

        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Zoom</span>
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
                step={0.05}
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

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Rotate</span>
            <button
              type="button"
              disabled={processing}
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className={styles.rotateBtn}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
              </svg>
              <span>Rotate 90°</span>
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
            {processing ? 'Applying...' : 'Apply & Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
