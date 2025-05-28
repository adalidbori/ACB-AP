let users = [
    {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'User',
        status: 'active',
        createdAt: '2024-01-15'
    },
    {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        role: 'Admin',
        status: 'active',
        createdAt: '2024-01-10'
    },
    {
        id: '3',
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@example.com',
        role: 'User',
        status: 'inactive',
        createdAt: '2024-01-05'
    }
];
cargarCompanias();
async function cargarCompanias() {
    try {
        const response = await fetch(`http://localhost:3000/companies`);
        companies = await response.json();
        const select = document.getElementById('companyId');
        select.innerHTML = '<option value="">Select a company</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.ID;
            option.textContent = company.CompanyName;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar compañías:', error);
    }
}
const form = document.getElementById('inviteForm');
const submitBtn = document.getElementById('submitBtn');
const submitText = document.getElementById('submitText');
const submitSpinner = document.getElementById('submitSpinner');

form.addEventListener('submit', async function (event) {
    event.preventDefault();

    // Mostrar spinner
    submitText.classList.add('d-none');
    submitSpinner.classList.remove('d-none');

    const formData = new FormData(form);
    const data = {
        WorkEmail: formData.get('workEmail'),
        CompanyID: formData.get('companyId'),
        RoleID: formData.get('roleId'),
    };
    try {
        const response = await fetch('http://localhost:3000/saveInvitation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            form.reset(); // Limpia el formulario
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Error de red: ' + error.message);
    } finally {
        // Ocultar spinner
        submitText.classList.remove('d-none');
        submitSpinner.classList.add('d-none');
    }
});

let currentEditingUserId = null;
let currentDeletingUserId = null;

// Utility functions
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

function showToast(message, type = 'success') {
    const toastContainer = document.querySelector('.toast-container');
    const toastId = 'toast-' + Date.now();

    const toastHtml = `
                <div class="toast fade-in" id="${toastId}" role="alert">
                    <div class="toast-header">
                        <i class="fas fa-${type === 'success' ? 'check-circle text-success' : 'exclamation-circle text-danger'} me-2"></i>
                        <strong class="me-auto">${type === 'success' ? 'Success' : 'Error'}</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                    </div>
                    <div class="toast-body">
                        ${message}
                    </div>
                </div>
            `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Render functions
function renderUsers(usersToRender = users) {
    const tbody = document.getElementById('usersTableBody');

    if (usersToRender.length === 0) {
        tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4 text-muted">
                            <i class="fas fa-users fa-2x mb-2 d-block"></i>
                            No users found
                        </td>
                    </tr>
                `;
        return;
    }

    tbody.innerHTML = usersToRender.map(user => `
                <tr>
                    <td class="fw-medium">${user.firstName} ${user.lastName}</td>
                    <td>${user.email}</td>
                    <td><span class="role-badge">${user.role}</span></td>
                    <td><span class="status-badge status-${user.status}">${user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span></td>
                    <td>${user.createdAt}</td>
                    <td class="text-end table-actions">
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editUser('${user.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteUser('${user.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
}

// User management functions
function addUser(userData) {
    const newUser = {
        ...userData,
        id: generateId(),
        createdAt: getCurrentDate()
    };
    users.push(newUser);
    renderUsers();
    return newUser;
}

function updateUser(id, updates) {
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        renderUsers();
        return users[userIndex];
    }
    return null;
}

function removeUser(id) {
    users = users.filter(user => user.id !== id);
    renderUsers();
}

function findUser(id) {
    return users.find(user => user.id === id);
}



function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredUsers = users.filter(user =>
        user.firstName.toLowerCase().includes(searchTerm) ||
        user.lastName.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm)
    );
    renderUsers(filteredUsers);
}

function editUser(id) {
    const user = findUser(id);
    if (!user) return;

    currentEditingUserId = id;

    // Populate form
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editFirstName').value = user.firstName;
    document.getElementById('editLastName').value = user.lastName;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editRole').value = user.role;
    document.getElementById('editStatus').value = user.status;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
}

function saveUser() {
    if (!currentEditingUserId) return;

    const updates = {
        firstName: document.getElementById('editFirstName').value.trim(),
        lastName: document.getElementById('editLastName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        role: document.getElementById('editRole').value,
        status: document.getElementById('editStatus').value
    };

    // Validation
    if (!updates.firstName || !updates.lastName || !updates.email || !updates.role) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    if (!validateEmail(updates.email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    // Check if email already exists (excluding current user)
    if (users.some(user => user.id !== currentEditingUserId && user.email.toLowerCase() === updates.email.toLowerCase())) {
        showToast('A user with this email already exists.', 'error');
        return;
    }

    updateUser(currentEditingUserId, updates);
    showToast('User updated successfully!');

    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
    modal.hide();

    currentEditingUserId = null;
}

function deleteUser(id) {
    const user = findUser(id);
    if (!user) return;

    currentDeletingUserId = id;
    document.getElementById('deleteUserName').textContent = `${user.firstName} ${user.lastName}`;

    const modal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
    modal.show();
}

function confirmDelete() {
    if (!currentDeletingUserId) return;

    removeUser(currentDeletingUserId);
    showToast('User deleted successfully!');

    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteUserModal'));
    modal.hide();

    currentDeletingUserId = null;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    // Initial render
    renderUsers();
    document.getElementById('saveUserBtn').addEventListener('click', saveUser);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Tab change handler to refresh admin panel
    document.getElementById('admin-tab').addEventListener('shown.bs.tab', function () {
        renderUsers();
        document.getElementById('searchInput').value = '';
    });
});