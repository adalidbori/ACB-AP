
window.miVariable = "localhost";


// Función para obtener los invoices y llenar la tabla


async function updateElement(invoiceId, rowData) {
  // Lista de campos permitidos (deben coincidir con lo que espera el servidor)
  const allowedFields = ['docName', 'invoiceNumber', 'referenceNumber', 'vendor', 'invoiceTotal', 'invoiceDate', 'dueDate'];

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

async function getSASUrl(documentUrl) {
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
  if (sasUrl) {
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

function editVendor() {
  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToEdit = [];
  checkboxes.forEach(chk => {
    if (chk.checked) {
      const row = chk.closest('tr');
      const id = row.dataset.id;
      if (id) {
        idsToEdit.push(parseInt(id, 10));
      }
    }
  });

  if (idsToEdit.length === 0) {
    alert("At least one row most be selected!");
    return;
  }

  const modalEl = document.getElementById('editModalId');

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('#saveVendorButton');
  saveButton.onclick = async () => {
    const texto = document.getElementById('vendor-input');
    const valor = texto.value.trim(); // Elimina espacios al inicio y al final

    if (valor === "") {
      alert("The field cannot be empty");
    } else {
      try {
        const response = await fetch(`http://${window.miVariable}:3000/editVendors`, {
          method: "PUT", // Se cambia a PUT
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idsToEdit, valor })
        });

        const result = await response.json();
        console.log("Resultado de la actualización:", result);
        modal.hide();
        loadInvoices();
      } catch (error) {
        console.error("Error editando los vendors!", error);
      }
    }
  };
  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  // Agrega el listener para limpiar el contenido del modal cuando se cierra
  modalEl.addEventListener('hidden.bs.modal', () => {
    // Reinicia el valor del input (y otros elementos si es necesario)
    const input = modalEl.querySelector('#vendor-input');
    if (input) {
      input.value = '';
    }
    // Si agregaste otros elementos o estados, reinícialos aquí
  }, { once: true }); // Con { once: true } nos aseguramos que el listener se ejecute solo una vez
}

async function deleteInvoiceByID(invoiceID) {
  try {
    // Enviar petición DELETE al servidor con los IDs a eliminar
    const response = await fetch(`http://${window.miVariable}:3000/invoices`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: invoiceID })
    });

    const result = await response.json();
    console.log("Resultado de la eliminación:", result);
  } catch (error) {
    console.error("Error eliminando registros:", error);
  }
}

async function updateStatus(invoiceStatus) {
  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToChange = [];
  const urlsToDelete = [];
  
  if (invoiceStatus === 6) {
    
    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        const id = row.dataset.id;
        const url = row.dataset.url;
        if (id) {
          idsToChange.push(parseInt(id, 10));
        }
        if (url) {
          urlsToDelete.push(url);
        }
      }
    });
  } else {
    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        const id = row.dataset.id;
        if (id) {
          idsToChange.push(parseInt(id, 10));
        }
      }
    });
  }



  if (idsToChange.length === 0) {
    alert("At least one row most be selected!");
    return;
  }

  if (invoiceStatus === 6) {
    console.log(urlsToDelete.length);
    if (urlsToDelete.length === 0) {
      alert("At least one URL most be selected!");
      return;
    }else{
      eliminarBlobMultiInvoice(urlsToDelete);
    }
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
notificationClose.addEventListener('click', function () {
  notificationBanner.style.display = 'none';
});

// Filter collapse functionality
const filterHeader = document.getElementById('filter-header');
const filterCollapse = document.getElementById('filterCollapse');
const filterArrow = document.querySelector('.filter-arrow');
const tableResponsive = document.querySelector('.table-responsive');
filterHeader.addEventListener('click', function () {
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

async function getDuplicatedByInvoiceNumber(texto) {
  const tableBody = document.querySelector("#duplicated-table tbody");
  const modalEl = document.getElementById('duplicatedElementsbyIDModal');
  try {
    const response = await fetch(`http://${window.miVariable}:3000/getDuplicatedByInvoiceNumber/${texto}`);
    if (!response.ok) {
      throw new Error('Error en la respuesta: ' + response.status);
    }
    const data = await response.json();
    data.forEach(invoice => {
      const tr = document.createElement("tr");
      tr.dataset.id = invoice.ID;
      tr.dataset.invoiceStatus = invoice.invoiceStatus;
      tr.dataset.url = invoice.fileURL;
      console.log("El vendor es: "+invoice.vendor);
      tr.innerHTML = `
          <td>
            <a class="dragout" href='#'
              onclick="openDocument('${invoice.fileURL}')" 
              draggable="true"
              data-filename="${invoice.docName}" 
              data-filetype="${invoice.fileType}">
              <div data-field="fileType">
                ${invoice.fileType === 'application/pdf'
          ? '<img src="/Styles/pdf.svg" alt="Icono PDF">'
          : '<img src="/Styles/image.svg" alt="Icono imagen">'
        }
              </div>
            </a>
          </td>
          <td><div data-field="invoiceNumber" style="${invoice.invoiceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceNumber}</div></td>
          <td><div data-field="vendor" style="${invoice.vendor ? '' : 'background-color: #f8d7da;'}">${limitCellText(invoice.vendor)}</div></td>
          <td>
          <div data-field="referenceNumber" style="${invoice.referenceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.referenceNumber}</div></td>
          <td><div data-field="invoiceTotal" style="${invoice.invoiceTotal ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceTotal}</div></td>
          <td><div data-field="invoiceDate" style="${invoice.invoiceDate ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceDate}</div></td>
          <td>
            <div data-field="invoiceStatus" style="${invoice.invoiceStatus ? '' : 'background-color: #f8d7da;'}">
              ${getInvoiceStatusText(invoice.invoiceStatus)}
            </div>
          </td>
          <td><div data-field="checknumber" style="${invoice.checknumber ? '' : 'background-color: #f8d7da;'}">${invoice.checknumber}</div></td>
          <td>
            <div style="text-align: center; cursor: pointer;">
              <!-- Se asigna un color por defecto (rojo) y luego se actualizará en función de la existencia de notas -->
              <div class="contenedor-icono">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" class="bi bi-trash" viewBox="0 0 16 16">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                </svg>
              </div>
            </div>
          </td>
        `;

      // Obtener el elemento SVG recién creado
      const svgElement = tr.querySelector('.bi-trash');

      // Asignar el controlador de eventos al SVG
      svgElement.addEventListener('click', function (event) {
        const invoiceId = tr.dataset.id;
        const urlToDelete = tr.dataset.url;
        deleteInvoiceByID(invoiceId);
        eliminarBlobMultiInvoice(urlToDelete);
        tr.remove();
      });
      tableBody.appendChild(tr);
    })

    //Show the modal here
    // Seleccionar el tbody de la tabla



    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    } else {
      console.error('El elemento modal no fue encontrado en el DOM.');
    }
    // Mostrar el modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  } catch (error) {
    console.error("Error getting the duplicated invoices", error);
  }

  modalEl.addEventListener('hidden.bs.modal', function () {
    //limpiar la tabla
    tableBody.innerHTML = "";
    // Buscar y eliminar el backdrop si aún existe
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.parentNode.removeChild(backdrop);
    }
    loadInvoices();
  });
}


function generateNotificationLinks(invoiceNumbers) {
  if (invoiceNumbers.length > 0) {
    const linksContainer = document.getElementById('notification-links');

    // Limpia el contenedor para evitar duplicados si se vuelve a ejecutar
    linksContainer.innerHTML = '';

    invoiceNumbers.forEach((number, index) => {
      const link = document.createElement('a');
      link.href = `#`; // Define el destino real si es necesario
      link.textContent = number;
      link.addEventListener('click', function (event) {
        event.preventDefault(); // Prevenir la acción por defecto del enlace
        getDuplicatedByInvoiceNumber(this.textContent); // Llama a la función pasando el textContent
      });

      linksContainer.appendChild(link);

      // Agrega una coma y espacio después de cada enlace (menos el último)
      if (index < invoiceNumbers.length - 1) {
        linksContainer.appendChild(document.createTextNode(', '));
      }
    });
    document.getElementById('notification-banner').style.display = 'flex';
  }
}

async function getDuplicatedInvoices() {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/getDuplicatedInvoices`);

    if (!response.ok) {
      throw new Error('Error en la respuesta: ' + response.status);
    }

    const data = await response.json();
    const invoiceNumbers = data.map(item => item.invoiceNumber);
    generateNotificationLinks(invoiceNumbers);
  } catch (error) {
    console.error('Error fetching duplicated invoices:', error);
  }
}

async function eliminarBlobMultiInvoice(urls) {
  try {
    // Enviar petición DELETE para Azure
    const response = await fetch(`http://${window.miVariable}:3000/eliminar-blob`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls })
    });
    const result = await response.json();
    console.log("Resultado de la eliminación de Azure Blob:", result);
  }
  catch (error) {
    console.error("Error eliminando registros Blob:", error);
  }
}



setTimeout(() => {
  //generateNotificationLinks()
  getDuplicatedInvoices();

}, 5000);

function getInvoiceStatusText(status) {
  switch (status) {
    case 1:
      return "Pending to Review";
    case 2:
      return "Waiting for Approval";
    case 3:
      return "Ready to Pay";
    case 4:
      return "Paid";
    default:
      return "";
  }
}

