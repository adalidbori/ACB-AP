
window.miVariable = "192.168.1.158";


// Función para obtener los invoices y llenar la tabla


async function updateElement(invoiceId, rowData) {
  // Lista de campos permitidos (deben coincidir con lo que espera el servidor)
  const allowedFields = ['docName', 'invoiceNumber', 'vendor', 'invoiceTotal', 'invoiceDate', 'dueDate'];

  // Itera sobre cada propiedad en rowData
  for (const field in rowData) {
    if (allowedFields.includes(field)) {
      const value = rowData[field];
      try {
        const response = await fetch(`http://${window.miVariable}:3000/invoices/${invoiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, value })
        });
        const result = await response.json();
        console.log(`Actualizado ${field}:`, result);
      } catch (error) {
        console.error(`Error actualizando ${field}:`, error);
      }
    }
  }
}

function showDocument(url, fileType) {
  const viewerContent = document.getElementById('viewer-content');
  if (!viewerContent) {
    console.error("No se encontró el contenedor con id 'viewer-content'");
    return;
  }

  // Dependiendo del tipo de archivo, muestra una imagen o un iframe
  if (fileType === "image/png" || fileType === "image/jpeg") {
    viewerContent.innerHTML = `<img src="${url}" alt="Documento" style="max-width:100%; height:auto;">`;
  } else {
    viewerContent.innerHTML = `<iframe src="${url}" style="width:100%; height:600px;" frameborder="0"></iframe>`;
  }
}


async function deleteSelectedRows() {
  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToDelete = [];

  checkboxes.forEach(chk => {
    if (chk.checked) {
      const row = chk.closest('tr');
      const id = row.dataset.id;
      if (id) {
        idsToDelete.push(parseInt(id, 10));
      }
    }
  });

  if (idsToDelete.length === 0) {
    alert("At least one row most be selected!");
    return;
  }

  try {
    // Enviar petición DELETE al servidor con los IDs a eliminar
    const response = await fetch(`http://${window.miVariable}:3000/invoices`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: idsToDelete })
    });

    const result = await response.json();
    console.log("Resultado de la eliminación:", result);

    // Si la eliminación es exitosa, remover las filas del DOM
    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        row.remove();
      }
    });
  } catch (error) {
    console.error("Error eliminando registros:", error);
  }
}

async function updateStatus(invoiceStatus) {
  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToChange = [];

  checkboxes.forEach(chk => {
    if (chk.checked) {
      const row = chk.closest('tr');
      const id = row.dataset.id;
      if (id) {
        idsToChange.push(parseInt(id, 10));
      }
    }
  });

  if (idsToChange.length === 0) {
    alert("At least one row most be selected!");
    return;
  }

  try {
    // Enviar petición Update al servidor con los IDs a actualizar
    const response = await fetch(`http://${window.miVariable}:3000/invoices/update/${invoiceStatus}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: idsToChange })
    });

    const result = await response.json();
    console.log("Resultado de la actualización:", result);

    // Si la eliminación es exitosa, remover las filas del DOM
    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        row.remove();
      }
    });
  } catch (error) {
    console.error("Error actualizando registros:", error);
  }
}