export function ReceiptPicker({
  disabled,
  onChoose,
}: {
  disabled?: boolean
  onChoose: (file: File) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="ui-button ui-button--secondary relative cursor-pointer focus-within:ring-2 focus-within:ring-ink">
        Choose photo or PDF
        <input
          aria-label="Choose receipt"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChoose(file)
            e.target.value = ''
          }}
        />
      </label>
      <label className="ui-button ui-button--secondary relative cursor-pointer focus-within:ring-2 focus-within:ring-ink">
        Take photo
        <input
          aria-label="Take receipt photo"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="file"
          capture="environment"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChoose(file)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
