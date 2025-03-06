document.querySelectorAll(".dragout").forEach(a => {
    a.addEventListener("dragstart", async function(evt) {
      // Archivo que se está arrastrando (desde el enlace)
      
      const draggedMimeType = this.getAttribute('data-filetype') || 'application/octet-stream';
      const draggedFileName = this.getAttribute('data-filename') || 'archivo';
      const draggedFileUrl = this.href;

      // Lista para almacenar la información de los archivos a arrastrar
      let filesToDrag = [];

      // Recopilar archivos de los checkboxes seleccionados
      const selectedCheckboxes = document.querySelectorAll(".row-checkbox:checked");
      selectedCheckboxes.forEach(checkbox => {
        const checkboxFileUrl = checkbox.getAttribute("data-fileurl");
        const checkboxFileType = checkbox.getAttribute("data-filetype") || 'application/octet-stream';
        const parts = checkboxFileUrl.split('/');
        const checkboxFileName = parts[parts.length - 1] || 'archivo';
        // Agregar solo si no existe ya en la lista
        if (!filesToDrag.some(file => file.url === checkboxFileUrl)) {
          filesToDrag.push({
            url: checkboxFileUrl,
            fileName: checkboxFileName,
            mimeType: checkboxFileType
          });
        }
      });

      // Incluir el archivo que se está arrastrando si no está duplicado
      if (!filesToDrag.some(file => file.url === draggedFileUrl)) {
        filesToDrag.push({
          url: draggedFileUrl,
          fileName: draggedFileName,
          mimeType: draggedMimeType
        });
      }

      // Limpiar los datos previos del DataTransfer
      evt.dataTransfer.clearData();

      // Si el navegador lo permite, agregar cada archivo como objeto File
      
        for (const fileInfo of filesToDrag) {
          try {
            const mimeType = fileInfo.mimeType;
            const fileName = fileInfo.fileName;
            const fileUrl = fileInfo.url;
            const timestampName = fileUrl.split('/').pop();
            let localUrl = window.location.protocol + "//" + window.location.host + "/uploads/" + timestampName;
            evt.dataTransfer.setData("DownloadURL", `${mimeType}:${fileName}:${localUrl}`);
          } catch (error) {
            console.error("Error al obtener el archivo para drag:", fileInfo.url, error);
          }
        }
      
    }, false);
  });