
window.miVariable = "localhost";


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
        loadInvoices();
      } catch (error) {
        console.error(`Error actualizando ${field}:`, error);
      }
    }
  }
}

async function getSASUrl(documentUrl){
  try {
    // Realiza la solicitud POST al servidor
    const response = await fetch(`http://${window.miVariable}:3000/open-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: documentUrl }) // Envía la URL del documento en el cuerpo de la solicitud
    });

    // Verifica si la respuesta es exitosa
    if (!response.ok) {
      throw new Error(`Error en la solicitud: ${response.statusText}`);
    }

    // Analiza la respuesta JSON
    const result = await response.json();
    // Verifica si la respuesta contiene la nueva URL
    if (result.newUrl) {
      // Abre la nueva URL en una ventana nueva
      return result.newUrl;
    } else {
      return '';
    }
  } catch (error) {
    console.error("Error al abrir el documento:", error);
    return '';
  }
}

async function openDocument(documentUrl) {
  try {
    const sasUrl = await getSASUrl(documentUrl);
    
    if (!sasUrl) {
      console.error("No se obtuvo una URL válida");
      return;
    }
    window.open(sasUrl, '_blank', 'noopener');
  } catch (error) {
    console.error("Error crítico al abrir el documento:", error);
    // Puedes mostrar un mensaje al usuario aquí
  }
}


async function showDocument(url, fileType) {
  const sasUrl = await getSASUrl(url);
  if(sasUrl){
    const viewerContent = document.getElementById('viewer-content');
    if (!viewerContent) {
      console.error("No se encontró el contenedor con id 'viewer-content'");
      return;
    }

    // Dependiendo del tipo de archivo, muestra una imagen o un iframe
    if (fileType === "image/png" || fileType === "image/jpeg") {
      viewerContent.innerHTML = `<img src="${sasUrl}" alt="Documento" style="max-width:100%; height:auto;">`;
    } else {
      viewerContent.innerHTML = `<iframe src="${sasUrl}" style="width:100%; height:600px;" frameborder="0"></iframe>`;
    }
  }
  
}

// Función para limitar caracteres visibles en celdas editables
function limitCellText(text, maxLength = 20) {
  if (!text || text.length <= maxLength) return text;
  
  // Guardar el texto completo como atributo data y mostrar versión truncada
  return `<span 
    title="${text}" 
    data-full-text="${text}" 
    class="truncated-text">${text.substring(0, maxLength)}...</span>`;
}


async function deleteSelectedRows() {
  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToDelete = [];
  const urlsToDelete = [];
  checkboxes.forEach(chk => {    
    if (chk.checked) {
      const row = chk.closest('tr');
      const id = row.dataset.id;
      const fileUrl = chk.dataset.fileurl;
      console.log(fileUrl);
      if (id) {
        idsToDelete.push(parseInt(id, 10));
      }
      if(fileUrl){
        urlsToDelete.push(fileUrl);
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
  try{
    // Enviar petición DELETE para Azure
    const response = await fetch(`http://${window.miVariable}:3000/eliminar-blob`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urlsToDelete })
    });
    const result = await response.json();
    console.log("Resultado de la eliminación de Azure Blob:", result);

    // Si la eliminación es exitosa, remover las filas del DOM
    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        row.remove();
      }
    });
  }
  catch(error){
    console.error("Error eliminando registros Blob:", error);
  }
  loadInvoices();
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
  loadInvoices();
}

async function getNotes(invoiceId) {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/invoices/notes/${invoiceId}`);
    const data = await response.json();
    // Suponiendo que 'data' es un arreglo de notas
    if (data.length > 0) {
      // Si existe alguna nota, la retornamos
      return data[0].content;
    } else {
      // Si no existe, retornamos una cadena vacía
      return '';
    }
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    return '';
  }
}

async function insertUpdateNotes(invoiceID, content) {
  const formattedContent = content.replace(/\r?\n/g, '\r\n');
  try {
    const response = await fetch(`http://${window.miVariable}:3000/notes-upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        invoiceID: invoiceID,
        content: formattedContent,
        userID: 1 //temporal value
      })
    });
    const serverResponse = await response.json();
    loadInvoices();
    return serverResponse.text;
  } catch (error) {
    console.error("Error en la inserción:", error);
    throw error;
  }
}

async function showNotesModal(invoiceId, invoiceNumber) {
  currentInvoiceId = invoiceId;
  const modalEl = document.getElementById('exampleModal');
  modalEl.querySelector('.modal-title').textContent = `Notes: ${invoiceNumber}`;

  // Obtener las notas de forma asincrónica y asignarlas al textarea
  const notesContent = await getNotes(invoiceId);
  modalEl.querySelector('#notes-text').value = notesContent;

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('.modal-save-button');
  saveButton.onclick = async () => {
    const notesContent = modalEl.querySelector('#notes-text').value;
    await insertUpdateNotes(invoiceId, notesContent);
    // Cierra el modal
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  };

  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function downloadSelectedFiles() {
  const checkboxes = document.querySelectorAll('.row-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Por favor, seleccione al menos un archivo.');
    return;
  }

  // Agrupar archivos por proveedor
  const filesByVendor = {};
  for (const checkbox of checkboxes) {
    const fileURL = await getSASUrl(checkbox.dataset.fileurl);
    const fileType = checkbox.dataset.filetype;
    const row = checkbox.closest('tr');
    const docName = row.querySelector('[data-field="docName"]').textContent.trim();
    const vendor = row.querySelector('[data-field="vendor"]').textContent.trim();
    const extension = obtenerExtension(fileType);
    const fileName = `${docName}${extension}`;

    if (!filesByVendor[vendor]) {
      filesByVendor[vendor] = [];
    }
    filesByVendor[vendor].push({ fileURL, fileName });
  }

  // Crear y descargar un ZIP por cada proveedor
  for (const [vendor, files] of Object.entries(filesByVendor)) {
    const zip = new JSZip();
    for (const { fileURL, fileName } of files) {
      try {
        const response = await fetch(fileURL, { mode: 'cors' });
        if (!response.ok) throw new Error(`Error al descargar ${fileName}`);
        const blob = await response.blob();
        zip.file(fileName, blob);
      } catch (error) {
        console.error(`No se pudo agregar el archivo ${fileName} al ZIP:`, error);
      }
    }

    // Generar el contenido del ZIP y descargarlo
    const zipContent = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipContent);
    link.download = `${vendor}.zip`;
    link.click();
  }
}


function obtenerExtension(fileType) {
  switch (fileType) {
    case 'application/pdf':
      return '.pdf';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    // Agrega más casos según sea necesario
    default:
      return '';
  }
}

function parseInternationalCurrency(amountStr) {
  return parseFloat(amountStr) || 0;
}

// Notification banner functionality
const notificationBanner = document.getElementById('notification-banner');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');

// Close notification banner
notificationClose.addEventListener('click', function() {
  notificationBanner.style.display = 'none';
});

// Filter collapse functionality
const filterHeader = document.getElementById('filter-header');
const filterCollapse = document.getElementById('filterCollapse');
const filterArrow = document.querySelector('.filter-arrow');
const tableResponsive = document.querySelector('.table-responsive');
  filterHeader.addEventListener('click', function() {
  const isCollapsed = filterCollapse.classList.contains('show');
  if (isCollapsed) {
    filterCollapse.classList.remove('show');
    filterArrow.style.transform = 'rotate(-90deg)';
    console.log("Cerrado");
    tableResponsive.style.maxHeight = '550px';
  } else {
    filterCollapse.classList.add('show');
    filterArrow.style.transform = 'rotate(0deg)';
    console.log("Abierto");
    tableResponsive.style.maxHeight = '400px';
  }
});