export const filesToDataUrls = async (files: FileList | File[]): Promise<string[]> =>
  Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
          reader.readAsDataURL(file)
        }),
    ),
  )
