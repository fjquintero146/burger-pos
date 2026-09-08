// img-utils.js
// Redimensiona una imagen en el navegador antes de convertirla a base64,
// para que no ocupe demasiado espacio en la base de datos.

function redimensionarImagen(file, maxLado = 400, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxLado) {
          height = Math.round(height * (maxLado / width));
          width = maxLado;
        } else if (height > maxLado) {
          width = Math.round(width * (maxLado / height));
          height = maxLado;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}
