// Global state
let currentUser = null;
let currentSection = 'dashboard';

// DOM Elements
const loginPage = document.getElementById('login-page');
const registerPage = document.getElementById('register-page');
const dashboard = document.getElementById('dashboard');
const loading = document.getElementById('loading');
const toastContainer = document.getElementById('toast-container');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuthStatus();
});

// Setup event listeners
function setupEventListeners() {
    // Auth forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('show-register').addEventListener('click', showRegisterPage);
    document.getElementById('show-login').addEventListener('click', showLoginPage);
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) {
                await navigateToSection(section);
            }
        });
    });

    // View all links
    document.querySelectorAll('.view-all').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) {
                await navigateToSection(section);
            }
        });
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Modal close
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Domain actions
    document.getElementById('purchase-domain-btn').addEventListener('click', showPurchaseDomainModal);
    document.getElementById('sync-domains-btn')?.addEventListener('click', syncDomains);
    
    // Email request actions
    document.getElementById('new-email-request-btn').addEventListener('click', showEmailRequestModal);
    
    // Admin actions
    document.getElementById('add-user-btn')?.addEventListener('click', showAddUserModal);
    
    // Search and filters
    document.getElementById('email-status-filter')?.addEventListener('change', filterEmailRequests);
    document.getElementById('user-search')?.addEventListener('input', debounce(searchUsers, 300));
    
    // Event delegation for dynamic buttons
    document.addEventListener('click', handleDynamicButtons);
}

// Handle dynamic button clicks
function handleDynamicButtons(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    
    e.preventDefault();
    
    const button = e.target.closest('[data-action]');
    
    switch (action) {
        case 'close-modal':
            closeModal();
            break;
        case 'view-domain':
            viewDomainDetails(button.dataset.domainId);
            break;
        case 'delete-domain':
            deleteDomain(button.dataset.domainId, button.dataset.domainName);
            break;
        case 'view-credentials':
            viewEmailCredentials(button.dataset.requestId);
            break;
        case 'approve-email':
            showApproveEmailModal(button.dataset.requestId);
            break;
        case 'reject-email':
            updateEmailRequestStatus(button.dataset.requestId, 'rejected');
            break;
        case 'delete-email':
            deleteEmailRequest(button.dataset.requestId);
            break;
        case 'view-smtp-imap':
            viewSmtpImapDetails(button.dataset.requestId);
            break;
        case 'toggle-password':
            togglePassword();
            break;
        case 'edit-user':
            editUser(button.dataset.userId);
            break;
        case 'delete-user':
            deleteUser(button.dataset.userId);
            break;
        case 'check-availability':
            checkDomainAvailability();
            break;
        case 'close-toast':
            button.closest('.toast').remove();
            break;
    }
}

// Authentication functions
async function checkAuthStatus() {
    try {
        showLoading();
        const response = await fetch('/api/auth/verify');
        const data = await response.json();
        
        if (data.valid) {
            currentUser = data.user;
            showDashboard();
            loadDashboardData();
            loadAccountBalance();
        } else {
            showLoginPage();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showLoginPage();
    } finally {
        hideLoading();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        showLoading();
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentUser = result.user;
            showToast('Login successful!', 'success');
            showDashboard();
            loadDashboardData();
            loadAccountBalance();
        } else {
            showToast(result.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        showLoading();
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentUser = result.user;
            showToast('Account created successfully!', 'success');
            showDashboard();
            loadDashboardData();
        } else {
            showToast(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        showToast('Logged out successfully', 'success');
        showLoginPage();
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
}

// Page navigation
function showLoginPage() {
    loginPage.classList.remove('hidden');
    registerPage.classList.add('hidden');
    dashboard.classList.add('hidden');
    document.body.classList.remove('is-admin');
}

function showRegisterPage() {
    loginPage.classList.add('hidden');
    registerPage.classList.remove('hidden');
    dashboard.classList.add('hidden');
}

function showDashboard() {
    loginPage.classList.add('hidden');
    registerPage.classList.add('hidden');
    dashboard.classList.remove('hidden');
    
    // Update user info
    document.getElementById('current-username').textContent = currentUser.username;
    document.getElementById('current-role').textContent = currentUser.isAdmin ? 'Admin' : 'User';
    
    // Show/hide admin elements
    if (currentUser.isAdmin) {
        document.body.classList.add('is-admin');
        // Initialize admin sections with loading state
        const usersContainer = document.getElementById('users-list');
        if (usersContainer) {
            usersContainer.innerHTML = '<p class="loading-text">Loading users...</p>';
        }
    }
}

async function navigateToSection(section) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
    
    currentSection = section;
    
    // Load section data
    await loadSectionData(section);
}

// Data loading functions
async function loadDashboardData() {
    try {
        // Load dashboard stats
        if (currentUser.isAdmin) {
            const response = await fetch('/api/admin/dashboard');
            const data = await response.json();
            
            if (data.success) {
                updateDashboardStats(data.stats);
                updateRecentActivity(data.recentActivity);
            }
            
            // Preload users data for admin
            await loadUsers();
        } else {
            // Load user-specific data
            await Promise.all([
                loadDomains(),
                loadEmailRequests()
            ]);
            updateUserStats();
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateDashboardStats(stats) {
    document.getElementById('total-domains').textContent = stats.domains.total || 0;
    document.getElementById('total-emails').textContent = stats.emails.created || 0;
    document.getElementById('pending-requests').textContent = stats.emails.pending || 0;
    document.getElementById('total-users').textContent = stats.users.totalUsers || 0;
}

async function updateUserStats() {
    try {
        const [domainsResponse, emailsResponse] = await Promise.all([
            fetch('/api/domains'),
            fetch('/api/emails')
        ]);
        
        const domains = await domainsResponse.json();
        const emails = await emailsResponse.json();
        
        if (domains.success && emails.success) {
            document.getElementById('total-domains').textContent = domains.domains.length;
            
            const totalEmails = domains.domains.reduce((total, domain) => 
                total + (domain.emails?.length || 0), 0);
            document.getElementById('total-emails').textContent = totalEmails;
            
            const pendingRequests = emails.emailRequests.filter(req => req.status === 'pending').length;
            document.getElementById('pending-requests').textContent = pendingRequests;
        }
    } catch (error) {
        console.error('Failed to update user stats:', error);
    }
}

function updateRecentActivity(activity) {
    // Update recent domains
    const recentDomainsContainer = document.getElementById('recent-domains');
    if (activity.domains && activity.domains.length > 0) {
        recentDomainsContainer.innerHTML = activity.domains.map(domain => `
            <div class="list-item">
                <div class="item-info">
                    <h4>${domain.domainName}</h4>
                    <p>Purchased ${formatDate(domain.createdAt)}</p>
                </div>
                <span class="status-badge status-${domain.status}">${domain.status}</span>
            </div>
        `).join('');
    } else {
        recentDomainsContainer.innerHTML = '<p class="loading-text">No domains yet</p>';
    }
    
    // Update recent email requests
    const recentEmailsContainer = document.getElementById('recent-email-requests');
    if (activity.emailRequests && activity.emailRequests.length > 0) {
        recentEmailsContainer.innerHTML = activity.emailRequests.map(request => `
            <div class="list-item">
                <div class="item-info">
                    <h4>${request.fullEmailAddress}</h4>
                    <p>Requested ${formatDate(request.createdAt)}</p>
                </div>
                <span class="status-badge status-${request.status}">${request.status}</span>
            </div>
        `).join('');
    } else {
        recentEmailsContainer.innerHTML = '<p class="loading-text">No email requests yet</p>';
    }
}

async function loadSectionData(section) {
    switch (section) {
        case 'domains':
            await loadDomains();
            break;
        case 'email-requests':
            await loadEmailRequests();
            break;
        case 'admin-users':
            if (currentUser && currentUser.isAdmin) {
                await loadUsers();
            }
            break;
        case 'admin-settings':
            if (currentUser && currentUser.isAdmin) {
                await loadAdminSettings();
            }
            break;
    }
}

async function loadDomains() {
    try {
        const response = await fetch('/api/domains');
        const data = await response.json();
        
        if (data.success) {
            renderDomainsTable(data.domains);
        } else {
            showToast('Failed to load domains', 'error');
        }
    } catch (error) {
        console.error('Failed to load domains:', error);
        showToast('Failed to load domains', 'error');
    }
}

function renderDomainsTable(domains) {
    const container = document.getElementById('domains-list');
    
    if (domains.length === 0) {
        container.innerHTML = '<p class="loading-text">No domains found</p>';
        return;
    }
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Domain Name</th>
                    <th>Status</th>
                    <th>Registration Date</th>
                    <th>Expiration Date</th>
                    <th>Emails</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${domains.map(domain => `
                    <tr>
                        <td><strong>${domain.domainName}</strong></td>
                        <td><span class="status-badge status-${domain.status}">${domain.status}</span></td>
                        <td>${formatDate(domain.registrationDate)}</td>
                        <td>${formatDate(domain.expirationDate)}</td>
                        <td>${domain.emails?.length || 0}</td>
                        <td>
                            <button class="btn btn-outline btn-sm" data-action="view-domain" data-domain-id="${domain._id}">
                                <i class="fas fa-eye"></i> Details
                            </button>
                            <button class="btn btn-error btn-sm" data-action="delete-domain" data-domain-id="${domain._id}" data-domain-name="${domain.domainName}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

async function loadEmailRequests() {
    try {
        const response = await fetch('/api/emails');
        const data = await response.json();
        
        if (data.success) {
            renderEmailRequestsTable(data.emailRequests);
        } else {
            showToast('Failed to load email requests', 'error');
        }
    } catch (error) {
        console.error('Failed to load email requests:', error);
        showToast('Failed to load email requests', 'error');
    }
}

function renderEmailRequestsTable(requests) {
    const container = document.getElementById('email-requests-list');
    
    if (requests.length === 0) {
        container.innerHTML = '<p class="loading-text">No email requests found</p>';
        return;
    }
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Email Address</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Requested Date</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${requests.map(request => `
                    <tr>
                        <td><strong>${request.fullEmailAddress}</strong></td>
                        <td>${request.domainName}</td>
                        <td><span class="status-badge status-${request.status}">${request.status}</span></td>
                        <td>${formatDate(request.createdAt)}</td>
                        <td>
                            ${request.status === 'pending' ? `
                                <button class="btn btn-outline btn-sm" data-action="view-credentials" data-request-id="${request._id}">
                                    <i class="fas fa-eye"></i> View Credentials
                                </button>
                            ` : ''}
                            ${currentUser.isAdmin ? `
                                ${request.status === 'pending' ? `
                                    <button class="btn btn-success btn-sm" data-action="approve-email" data-request-id="${request._id}">
                                        <i class="fas fa-check"></i> Approve
                                    </button>
                                    <button class="btn btn-error btn-sm" data-action="reject-email" data-request-id="${request._id}">
                                        <i class="fas fa-times"></i> Reject
                                    </button>
                                ` : ''}
                                ${request.status === 'created' ? `
                                    <button class="btn btn-outline btn-sm" data-action="view-smtp-imap" data-request-id="${request._id}">
                                        <i class="fas fa-server"></i> SMTP/IMAP
                                    </button>
                                ` : ''}
                            ` : ''}
                            ${request.status === 'pending' ? `
                                <button class="btn btn-error btn-sm" data-action="delete-email" data-request-id="${request._id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// Modal functions
function showModal(title, content) {
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
            <button class="modal-close" data-action="close-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            ${content}
        </div>
    `;
    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
}

function showPurchaseDomainModal() {
    const content = `
        <form id="purchase-domain-form">
            <div class="form-group">
                <label for="domain-name">Domain Name</label>
                <input type="text" id="domain-name" name="domain" placeholder="example.com" required>
            </div>
            <div class="form-group">
                <label for="domain-years">Registration Years</label>
                <select id="domain-years" name="years">
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="5">5 Years</option>
                </select>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
                <button type="button" class="btn btn-primary" data-action="check-availability">
                    <i class="fas fa-search"></i> Check Availability
                </button>
                <button type="submit" class="btn btn-success" id="purchase-btn" disabled>
                    <i class="fas fa-shopping-cart"></i> Purchase Domain
                </button>
            </div>
        </form>
        <div id="availability-result" class="mt-4"></div>
    `;
    
    showModal('Purchase New Domain', content);
    
    document.getElementById('purchase-domain-form').addEventListener('submit', handleDomainPurchase);
    
    // Update total price when years selection changes
    document.getElementById('domain-years').addEventListener('change', updateTotalPrice);
}

function updateTotalPrice() {
    const resultDiv = document.getElementById('availability-result');
    const totalPriceElement = resultDiv.querySelector('.total-price');
    
    if (totalPriceElement) {
        const years = parseInt(document.getElementById('domain-years').value) || 1;
        const pricePerYear = parseFloat(resultDiv.querySelector('.price-per-year').textContent.replace('$', '').replace('/year', ''));
        
        if (pricePerYear) {
            const totalPrice = (pricePerYear * years).toFixed(2);
            totalPriceElement.innerHTML = `Total for ${years} year${years > 1 ? 's' : ''}: <strong>$${totalPrice}</strong>`;
        }
    }
}

async function checkDomainAvailability() {
    const domainName = document.getElementById('domain-name').value.trim();
    
    if (!domainName) {
        showToast('Please enter a domain name', 'warning');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch('/api/domains/check-availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: domainName })
        });
        
        const data = await response.json();
        const resultDiv = document.getElementById('availability-result');
        const purchaseBtn = document.getElementById('purchase-btn');
        
        if (data.success) {
            if (data.available) {
                const years = document.getElementById('domain-years').value || 1;
                const totalPrice = data.pricing ? (data.pricing * parseInt(years)).toFixed(2) : 'N/A';
                
                resultDiv.innerHTML = `
                    <div class="availability-result available">
                        <div class="result-header">
                            <i class="fas fa-check-circle"></i>
                            <h3>Domain Available!</h3>
                        </div>
                        <div class="result-details">
                            <div class="domain-name">${data.domain}</div>
                            ${data.pricing ? `
                                <div class="pricing-info">
                                    <div class="price-per-year">$${data.pricing}/year</div>
                                    <div class="total-price">Total for ${years} year${years > 1 ? 's' : ''}: <strong>$${totalPrice}</strong></div>
                                </div>
                            ` : `
                                <div class="pricing-info">
                                    <div class="pricing-unavailable">
                                        <i class="fas fa-info-circle"></i>
                                        Pricing information not available via API
                                    </div>
                                    <div class="pricing-note">You can still proceed with purchase</div>
                                </div>
                            `}
                        </div>
                    </div>
                `;
                purchaseBtn.disabled = false;
            } else {
                resultDiv.innerHTML = `
                    <div class="availability-result unavailable">
                        <div class="result-header">
                            <i class="fas fa-times-circle"></i>
                            <h3>Domain Not Available</h3>
                        </div>
                        <div class="result-details">
                            <div class="domain-name">${data.domain}</div>
                            ${data.reason ? `<div class="reason">${data.reason}</div>` : ''}
                        </div>
                    </div>
                `;
                purchaseBtn.disabled = true;
            }
        } else {
            showToast(data.message || 'Failed to check availability', 'error');
        }
    } catch (error) {
        console.error('Availability check error:', error);
        showToast('Failed to check domain availability', 'error');
    } finally {
        hideLoading();
    }
}

async function handleDomainPurchase(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        showLoading();
        const response = await fetch('/api/domains/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Domain purchased successfully!', 'success');
            closeModal();
            loadDomains();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to purchase domain', 'error');
        }
    } catch (error) {
        console.error('Domain purchase error:', error);
        showToast('Failed to purchase domain', 'error');
    } finally {
        hideLoading();
    }
}

function showEmailRequestModal() {
    // First, load domains for the dropdown
    loadDomainsForModal();
}

async function loadDomainsForModal() {
    try {
        const response = await fetch('/api/domains');
        const data = await response.json();
        
        if (data.success) {
            const domainOptions = data.domains
                .filter(domain => domain.status === 'active')
                .map(domain => `<option value="${domain._id}">${domain.domainName}</option>`)
                .join('');
            
            const content = `
                <form id="email-request-form">
                    <div class="form-group">
                        <label for="email-domain">Domain</label>
                        <select id="email-domain" name="domainId" required>
                            <option value="">Select a domain</option>
                            ${domainOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="email-username">Email Username</label>
                        <input type="text" id="email-username" name="username" placeholder="username" required>
                        <small>The full email will be: username@domain.com</small>
                    </div>
                    <div class="form-group">
                        <label for="email-password">Password</label>
                        <input type="password" id="email-password" name="password" required>
                        <small>Must be at least 8 characters with uppercase, lowercase, number, and special character</small>
                    </div>
                    <div class="form-group">
                        <label for="email-notes">Notes (optional)</label>
                        <textarea id="email-notes" name="notes" rows="3" placeholder="Any additional notes..."></textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-envelope"></i> Request Email
                        </button>
                    </div>
                </form>
            `;
            
            showModal('Request New Email Address', content);
            
            document.getElementById('email-request-form').addEventListener('submit', handleEmailRequest);
        } else {
            showToast('No active domains found', 'warning');
        }
    } catch (error) {
        console.error('Failed to load domains:', error);
        showToast('Failed to load domains', 'error');
    }
}

async function handleEmailRequest(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        showLoading();
        const response = await fetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Email request submitted successfully!', 'success');
            closeModal();
            loadEmailRequests();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to submit email request', 'error');
        }
    } catch (error) {
        console.error('Email request error:', error);
        showToast('Failed to submit email request', 'error');
    } finally {
        hideLoading();
    }
}

// Admin functions
async function updateEmailRequestStatus(requestId, status) {
    try {
        showLoading();
        const response = await fetch(`/api/emails/${requestId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`Email request ${status}!`, 'success');
            loadEmailRequests();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Status update error:', error);
        showToast('Failed to update status', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteEmailRequest(requestId) {
    if (!confirm('Are you sure you want to delete this email request?')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/emails/${requestId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Email request deleted!', 'success');
            loadEmailRequests();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to delete request', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete request', 'error');
    } finally {
        hideLoading();
    }
}

// Utility functions
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close" data-action="close-toast">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Missing functions
async function syncDomains() {
    if (!confirm('This will sync all domains from your Namecheap account. Continue?')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch('/api/domains/sync', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`Synced ${result.syncedCount} domains successfully!`, 'success');
            loadDomains();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to sync domains', 'error');
        }
    } catch (error) {
        console.error('Sync domains error:', error);
        showToast('Failed to sync domains', 'error');
    } finally {
        hideLoading();
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            renderUsersTable(data.users);
        } else {
            showToast('Failed to load users', 'error');
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        showToast('Failed to load users', 'error');
    }
}

function renderUsersTable(users) {
    const container = document.getElementById('users-list');
    
    if (!users) {
        container.innerHTML = '<p class="loading-text">Loading users...</p>';
        return;
    }
    
    if (users.length === 0) {
        container.innerHTML = '<p class="loading-text">No users found</p>';
        return;
    }
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td><strong>${user.username}</strong></td>
                        <td>${user.email}</td>
                        <td><span class="status-badge ${user.isAdmin ? 'status-created' : 'status-active'}">${user.isAdmin ? 'Admin' : 'User'}</span></td>
                        <td>${formatDate(user.createdAt)}</td>
                        <td>${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</td>
                        <td>
                            <button class="btn btn-outline btn-sm" data-action="edit-user" data-user-id="${user._id}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            ${user._id !== currentUser._id ? `
                                <button class="btn btn-error btn-sm" data-action="delete-user" data-user-id="${user._id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

async function loadAdminSettings() {
    try {
        const [settingsResponse, logsResponse] = await Promise.all([
            fetch('/api/admin/settings'),
            fetch('/api/admin/logs')
        ]);
        
        const settings = await settingsResponse.json();
        const logs = await logsResponse.json();
        
        if (settings.success) {
            renderSystemStatus(settings.settings);
        }
        
        if (logs.success) {
            renderActivityLogs(logs.activities);
        }
    } catch (error) {
        console.error('Failed to load admin settings:', error);
        showToast('Failed to load admin settings', 'error');
    }
}

function renderSystemStatus(settings) {
    const container = document.getElementById('system-status');
    
    const statusItems = [
        {
            label: 'Database Connection',
            status: settings.database.connected ? 'Connected' : 'Disconnected',
            type: settings.database.connected ? 'success' : 'error'
        },
        {
            label: 'Namecheap API',
            status: settings.namecheapAPI.configured ? 'Configured' : 'Not Configured',
            type: settings.namecheapAPI.configured ? 'success' : 'warning'
        },
        {
            label: 'Environment',
            status: settings.environment,
            type: settings.environment === 'production' ? 'success' : 'warning'
        },
        {
            label: 'Sandbox Mode',
            status: settings.namecheapAPI.sandbox ? 'Enabled' : 'Disabled',
            type: settings.namecheapAPI.sandbox ? 'warning' : 'success'
        }
    ];
    
    container.innerHTML = statusItems.map(item => `
        <div class="status-item">
            <span>${item.label}</span>
            <span class="status-badge status-${item.type === 'success' ? 'active' : item.type === 'error' ? 'rejected' : 'pending'}">${item.status}</span>
        </div>
    `).join('');
}

function renderActivityLogs(activities) {
    const container = document.getElementById('activity-logs');
    
    if (activities.length === 0) {
        container.innerHTML = '<p class="loading-text">No activity logs found</p>';
        return;
    }
    
    container.innerHTML = activities.map(activity => `
        <div class="log-item">
            <div class="log-header">
                <span class="log-type">${activity.type.replace(/_/g, ' ')}</span>
                <span class="log-time">${formatDate(activity.timestamp)}</span>
            </div>
            <div class="log-description">${activity.description}</div>
        </div>
    `).join('');
}

function showAddUserModal() {
    const content = `
        <form id="add-user-form">
            <div class="form-group">
                <label for="new-username">Username</label>
                <input type="text" id="new-username" name="username" required>
            </div>
            <div class="form-group">
                <label for="new-email">Email</label>
                <input type="email" id="new-email" name="email" required>
            </div>
            <div class="form-group">
                <label for="new-password">Password</label>
                <input type="password" id="new-password" name="password" required>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="isAdmin" value="true">
                    Administrator privileges
                </label>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-user-plus"></i> Create User
                </button>
            </div>
        </form>
    `;
    
    showModal('Add New User', content);
    
    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
}

async function handleAddUser(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.isAdmin = data.isAdmin === 'true';
    
    try {
        showLoading();
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('User created successfully!', 'success');
            closeModal();
            loadUsers();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to create user', 'error');
        }
    } catch (error) {
        console.error('Create user error:', error);
        showToast('Failed to create user', 'error');
    } finally {
        hideLoading();
    }
}

async function editUser(userId) {
    // Implementation for editing users - simplified for now
    showToast('Edit user functionality coming soon', 'info');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('User deleted successfully!', 'success');
            loadUsers();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showToast('Failed to delete user', 'error');
    } finally {
        hideLoading();
    }
}

async function filterEmailRequests() {
    const status = document.getElementById('email-status-filter').value;
    const url = status ? `/api/emails?status=${status}` : '/api/emails';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            renderEmailRequestsTable(data.emailRequests);
        }
    } catch (error) {
        console.error('Failed to filter email requests:', error);
    }
}

async function searchUsers() {
    const searchTerm = document.getElementById('user-search').value;
    const url = searchTerm ? `/api/admin/users?search=${encodeURIComponent(searchTerm)}` : '/api/admin/users';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            renderUsersTable(data.users);
        }
    } catch (error) {
        console.error('Failed to search users:', error);
    }
}

// Function definitions for button handlers
async function deleteDomain(domainId, domainName) {
    if (!confirm(`Are you sure you want to delete the domain "${domainName}" from the database?\n\nNote: This will only remove it from your dashboard, not from your Namecheap account.`)) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/domains/${domainId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`Domain "${domainName}" deleted from database successfully!`, 'success');
            loadDomains();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to delete domain', 'error');
        }
    } catch (error) {
        console.error('Delete domain error:', error);
        showToast('Failed to delete domain', 'error');
    } finally {
        hideLoading();
    }
}

async function viewDomainDetails(domainId) {
    try {
        const response = await fetch(`/api/domains/${domainId}`);
        const data = await response.json();
        
        if (data.success) {
            const domain = data.domain;
            const emailsList = domain.emails && domain.emails.length > 0 
                ? domain.emails.map(email => `<li>${email.fullEmail}</li>`).join('')
                : '<li>No email addresses yet</li>';
            
            const content = `
                <div class="domain-details">
                    <h3>${domain.domainName}</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Status:</strong>
                            <span class="status-badge status-${domain.status}">${domain.status}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Registration Date:</strong>
                            ${formatDate(domain.registrationDate)}
                        </div>
                        <div class="detail-item">
                            <strong>Expiration Date:</strong>
                            ${formatDate(domain.expirationDate)}
                        </div>
                        <div class="detail-item">
                            <strong>Auto Renew:</strong>
                            ${domain.autoRenew ? 'Yes' : 'No'}
                        </div>
                    </div>
                    <h4>Email Addresses (${domain.emails?.length || 0})</h4>
                    <ul class="emails-list">
                        ${emailsList}
                    </ul>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" data-action="close-modal">Close</button>
                </div>
            `;
            
            showModal('Domain Details', content);
        } else {
            showToast('Failed to load domain details', 'error');
        }
    } catch (error) {
        console.error('Failed to load domain details:', error);
        showToast('Failed to load domain details', 'error');
    }
}

// Load account balance
async function loadAccountBalance() {
    try {
        const response = await fetch('/api/domains/balance');
        const data = await response.json();
        
        const balanceElement = document.getElementById('account-balance');
        
        if (data.success) {
            const formattedBalance = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: data.currency || 'USD',
                minimumFractionDigits: 2
            }).format(data.balance);
            
            balanceElement.textContent = formattedBalance;
            balanceElement.title = `Available Balance: ${formattedBalance}`;
        } else {
            balanceElement.textContent = 'Balance unavailable';
            balanceElement.title = 'Could not load account balance';
            console.warn('Failed to load balance:', data.message);
        }
    } catch (error) {
        console.error('Balance loading error:', error);
        const balanceElement = document.getElementById('account-balance');
        balanceElement.textContent = 'Error loading';
        balanceElement.title = 'Error loading account balance';
    }
}

// View email credentials
async function viewEmailCredentials(requestId) {
    try {
        const response = await fetch(`/api/emails/${requestId}`);
        const data = await response.json();
        
        if (data.success) {
            const request = data.emailRequest;
            const content = `
                <div class="modal-header">
                    <h2><i class="fas fa-eye"></i> Email Credentials</h2>
                    <button class="modal-close" data-action="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="credentials-info">
                        <div class="credential-item">
                            <label><strong>Email Address:</strong></label>
                            <div class="credential-value">${request.fullEmailAddress}</div>
                        </div>
                        <div class="credential-item">
                            <label><strong>Username:</strong></label>
                            <div class="credential-value">${request.requestedUsername}</div>
                        </div>
                        <div class="credential-item">
                            <label><strong>Password:</strong></label>
                            <div class="credential-value password-field">
                                <span id="password-display">••••••••</span>
                                <button type="button" class="btn btn-outline btn-sm" data-action="toggle-password">
                                    <i class="fas fa-eye" id="password-toggle-icon"></i>
                                </button>
                            </div>
                            <input type="hidden" id="actual-password" value="${request.password}">
                        </div>
                        <div class="credential-item">
                            <label><strong>Domain:</strong></label>
                            <div class="credential-value">${request.domainName}</div>
                        </div>
                        <div class="credential-item">
                            <label><strong>Requested Date:</strong></label>
                            <div class="credential-value">${formatDate(request.createdAt)}</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" data-action="close-modal">Close</button>
                </div>
            `;
            
            showModal('Email Credentials', content);
        } else {
            showToast('Failed to load credentials', 'error');
        }
    } catch (error) {
        console.error('Failed to load credentials:', error);
        showToast('Failed to load credentials', 'error');
    }
}

// Toggle password visibility
function togglePassword() {
    const passwordDisplay = document.getElementById('password-display');
    const actualPassword = document.getElementById('actual-password').value;
    const toggleIcon = document.getElementById('password-toggle-icon');
    
    if (passwordDisplay.textContent === '••••••••') {
        passwordDisplay.textContent = actualPassword;
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        passwordDisplay.textContent = '••••••••';
        toggleIcon.className = 'fas fa-eye';
    }
}

// Show approve email modal with SMTP/IMAP form
async function showApproveEmailModal(requestId) {
    try {
        const response = await fetch(`/api/emails/${requestId}`);
        const data = await response.json();
        
        if (data.success) {
            const request = data.emailRequest;
            const content = `
                <div class="modal-header">
                    <h2><i class="fas fa-check"></i> Approve Email Request</h2>
                    <button class="modal-close" data-action="close-modal">&times;</button>
                </div>
                <form id="approve-email-form" class="modal-form">
                    <div class="email-info">
                        <h3>Email: ${request.fullEmailAddress}</h3>
                        <p>Requested by: ${request.requestedBy.username}</p>
                    </div>
                    
                    <div class="form-section">
                        <h4><i class="fas fa-paper-plane"></i> SMTP Settings (Outgoing Mail)</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="smtp-server">SMTP Server</label>
                                <input type="text" id="smtp-server" name="smtpServer" placeholder="mail.${request.domainName}" required>
                            </div>
                            <div class="form-group">
                                <label for="smtp-port">Port</label>
                                <select id="smtp-port" name="smtpPort" required>
                                    <option value="587">587 (STARTTLS)</option>
                                    <option value="465">465 (SSL/TLS)</option>
                                    <option value="25">25 (None)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="smtp-security">Security</label>
                                <select id="smtp-security" name="smtpSecurity" required>
                                    <option value="STARTTLS">STARTTLS</option>
                                    <option value="SSL/TLS">SSL/TLS</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="smtp-username">SMTP Username</label>
                                <input type="text" id="smtp-username" name="smtpUsername" value="${request.fullEmailAddress}" required>
                            </div>
                            <div class="form-group">
                                <label for="smtp-password">SMTP Password</label>
                                <input type="password" id="smtp-password" name="smtpPassword" value="${request.password}" required>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4><i class="fas fa-inbox"></i> IMAP Settings (Incoming Mail)</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="imap-server">IMAP Server</label>
                                <input type="text" id="imap-server" name="imapServer" placeholder="mail.${request.domainName}" required>
                            </div>
                            <div class="form-group">
                                <label for="imap-port">Port</label>
                                <select id="imap-port" name="imapPort" required>
                                    <option value="993">993 (SSL/TLS)</option>
                                    <option value="143">143 (STARTTLS)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="imap-security">Security</label>
                                <select id="imap-security" name="imapSecurity" required>
                                    <option value="SSL/TLS">SSL/TLS</option>
                                    <option value="STARTTLS">STARTTLS</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="imap-username">IMAP Username</label>
                                <input type="text" id="imap-username" name="imapUsername" value="${request.fullEmailAddress}" required>
                            </div>
                            <div class="form-group">
                                <label for="imap-password">IMAP Password</label>
                                <input type="password" id="imap-password" name="imapPassword" value="${request.password}" required>
                            </div>
                        </div>
                    </div>
                    
                    <input type="hidden" name="requestId" value="${requestId}">
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
                        <button type="submit" class="btn btn-success">
                            <i class="fas fa-check"></i> Approve & Save Settings
                        </button>
                    </div>
                </form>
            `;
            
            showModal('Approve Email Request', content);
            
            // Add form handler
            document.getElementById('approve-email-form').addEventListener('submit', handleApproveEmail);
            
            // Update port when security changes
            document.getElementById('smtp-security').addEventListener('change', updateSmtpPort);
            document.getElementById('imap-security').addEventListener('change', updateImapPort);
            
        } else {
            showToast('Failed to load email request', 'error');
        }
    } catch (error) {
        console.error('Failed to load email request:', error);
        showToast('Failed to load email request', 'error');
    }
}

// Update SMTP port based on security selection
function updateSmtpPort() {
    const security = document.getElementById('smtp-security').value;
    const port = document.getElementById('smtp-port');
    
    switch(security) {
        case 'STARTTLS':
            port.value = '587';
            break;
        case 'SSL/TLS':
            port.value = '465';
            break;
        case 'None':
            port.value = '25';
            break;
    }
}

// Update IMAP port based on security selection
function updateImapPort() {
    const security = document.getElementById('imap-security').value;
    const port = document.getElementById('imap-port');
    
    switch(security) {
        case 'SSL/TLS':
            port.value = '993';
            break;
        case 'STARTTLS':
            port.value = '143';
            break;
        case 'None':
            port.value = '143';
            break;
    }
}

// Handle approve email form submission
async function handleApproveEmail(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const requestId = formData.get('requestId');
    
    const approvalData = {
        status: 'created',
        smtpSettings: {
            server: formData.get('smtpServer'),
            port: parseInt(formData.get('smtpPort')),
            security: formData.get('smtpSecurity'),
            username: formData.get('smtpUsername'),
            password: formData.get('smtpPassword')
        },
        imapSettings: {
            server: formData.get('imapServer'),
            port: parseInt(formData.get('imapPort')),
            security: formData.get('imapSecurity'),
            username: formData.get('imapUsername'),
            password: formData.get('imapPassword')
        }
    };
    
    try {
        showLoading();
        
        const response = await fetch(`/api/emails/${requestId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(approvalData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Email request approved with SMTP/IMAP settings!', 'success');
            closeModal();
            loadEmailRequests();
            loadDashboardData();
        } else {
            showToast(result.message || 'Failed to approve email request', 'error');
        }
    } catch (error) {
        console.error('Approve email error:', error);
        showToast('Failed to approve email request', 'error');
    } finally {
        hideLoading();
    }
}

// View SMTP/IMAP details for approved requests
async function viewSmtpImapDetails(requestId) {
    try {
        const response = await fetch(`/api/emails/${requestId}`);
        const data = await response.json();
        
        if (data.success) {
            const request = data.emailRequest;
            const smtp = request.smtpSettings || {};
            const imap = request.imapSettings || {};
            
            const content = `
                <div class="modal-header">
                    <h2><i class="fas fa-server"></i> SMTP/IMAP Settings</h2>
                    <button class="modal-close" data-action="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="email-settings">
                        <div class="settings-header">
                            <h3>${request.fullEmailAddress}</h3>
                            <span class="status-badge status-${request.status}">${request.status}</span>
                        </div>
                        
                        <div class="settings-section">
                            <h4><i class="fas fa-paper-plane"></i> SMTP Settings (Outgoing Mail)</h4>
                            <div class="settings-grid">
                                <div class="setting-item">
                                    <label>Server:</label>
                                    <span>${smtp.server || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Port:</label>
                                    <span>${smtp.port || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Security:</label>
                                    <span>${smtp.security || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Username:</label>
                                    <span>${smtp.username || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Password:</label>
                                    <span class="password-hidden">••••••••</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4><i class="fas fa-inbox"></i> IMAP Settings (Incoming Mail)</h4>
                            <div class="settings-grid">
                                <div class="setting-item">
                                    <label>Server:</label>
                                    <span>${imap.server || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Port:</label>
                                    <span>${imap.port || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Security:</label>
                                    <span>${imap.security || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Username:</label>
                                    <span>${imap.username || 'Not configured'}</span>
                                </div>
                                <div class="setting-item">
                                    <label>Password:</label>
                                    <span class="password-hidden">••••••••</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" data-action="close-modal">Close</button>
                </div>
            `;
            
            showModal('SMTP/IMAP Settings', content);
        } else {
            showToast('Failed to load SMTP/IMAP settings', 'error');
        }
    } catch (error) {
        console.error('Failed to load SMTP/IMAP settings:', error);
        showToast('Failed to load SMTP/IMAP settings', 'error');
    }
}
