// API Base URL - empty means same origin
const API_BASE = '';

// State
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
let token = localStorage.getItem('token');
let currentUser = null;

// DOM Elements
const cartBtn = document.getElementById('cartBtn');
const cartSidebar = document.getElementById('cartSidebar');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const emptyCart = document.getElementById('emptyCart');
const cartCount = document.getElementById('cartCount');
const wishlistBtn = document.getElementById('wishlistBtn');
const wishlistSidebar = document.getElementById('wishlistSidebar');
const wishlistItems = document.getElementById('wishlistItems');
const wishlistCountElement = document.getElementById('wishlistCount');
const overlay = document.getElementById('overlay');
const signinBtn = document.getElementById('signinBtn');
const userMenu = document.getElementById('userMenu');
const userEmail = document.getElementById('userEmail');
const signOutBtn = document.getElementById('signOutBtn');
const authModal = document.getElementById('authModal');
const closeAuth = document.getElementById('closeAuth');

// Product icons based on name
function getProductIcon(name) {
    const icons = {
        'botanical': '🌿',
        'rose': '🌸',
        'green tea': '🍃',
        'hydrating': '💧',
        'lavender': '🛁',
        'charcoal': '🧼',
        'serum': '💧',
        'cleanser': '🧴',
        'toner': '✨',
        'moisturizer': '💫'
    };
    
    const nameLower = name.toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
        if (nameLower.includes(key)) return icon;
    }
    return '🌿';
}

// Fetch products from API
async function fetchProducts() {
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        allProducts = await response.json();
        return allProducts;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

// Render product card
function renderProductCard(product) {
    const icon = product.image_url 
        ? `<img src="${product.image_url}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;">`
        : getProductIcon(product.name);
    
    const isInWishlist = wishlist.some(w => w.id === product.id);
    const isInCart = cart.some(c => c.id === product.id);
    const outOfStock = product.stock <= 0;
    
    return `
        <div class="product-card" data-product-id="${product.id}" data-testid="product-card-${product.id}">
            <div class="product-image">${icon}</div>
            <div class="product-info">
                <h3 class="product-title">${product.name}</h3>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <div class="rating">★★★★★</div>
                <div class="product-actions">
                    <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" 
                            data-product-id="${product.id}"
                            data-testid="wishlist-${product.id}">❤️</button>
                    <button class="add-to-cart ${isInCart ? 'added' : ''} ${outOfStock ? 'out-of-stock' : ''}" 
                            data-product-id="${product.id}"
                            data-testid="add-to-cart-${product.id}"
                            ${outOfStock ? 'disabled' : ''}>
                        ${outOfStock ? 'Out of Stock' : (isInCart ? 'In Cart' : 'Add to Cart')}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Render products grid
async function renderProducts(containerId, filterFn = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (allProducts.length === 0) {
        await fetchProducts();
    }
    
    let products = allProducts;
    if (filterFn) {
        products = products.filter(filterFn);
    }
    
    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #4A4A4A;">No products found</div>';
        return;
    }
    
    container.innerHTML = products.map(p => renderProductCard(p)).join('');
    attachProductListeners(container);
}

// Attach event listeners to product cards
function attachProductListeners(container) {
    container.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', handleAddToCart);
    });
    
    container.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.addEventListener('click', handleWishlistToggle);
    });
}

// Handle add to cart
async function handleAddToCart(e) {
    if (!token) {
        openAuthModal();
        return;
    }
    
    const productId = parseInt(e.target.dataset.productId);
    const product = allProducts.find(p => p.id === productId);
    if (!product || product.stock <= 0) return;
    
    // Add to cart API
    try {
        const response = await fetch(`${API_BASE}/api/cart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ product_id: productId, quantity: 1 })
        });
        
        if (response.ok) {
            // Update local cart
            const existingItem = cart.find(c => c.id === productId);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                cart.push({ ...product, quantity: 1 });
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            
            // Visual feedback
            const btn = e.target;
            btn.textContent = 'Added!';
            btn.classList.add('added');
            setTimeout(() => {
                btn.textContent = 'In Cart';
            }, 1500);
            
            updateCartCount();
            renderCart();
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to add to cart');
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        // Fallback to local cart
        const existingItem = cart.find(c => c.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        
        const btn = e.target;
        btn.textContent = 'Added!';
        btn.classList.add('added');
        setTimeout(() => {
            btn.textContent = 'In Cart';
        }, 1500);
        
        updateCartCount();
    }
}

// Handle wishlist toggle
function handleWishlistToggle(e) {
    if (!token) {
        openAuthModal();
        return;
    }
    
    const productId = parseInt(e.target.dataset.productId);
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const index = wishlist.findIndex(w => w.id === productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        e.target.classList.remove('active');
    } else {
        wishlist.push(product);
        e.target.classList.add('active');
    }
    
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
}

// Update cart count
function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (cartCount) {
        cartCount.textContent = count;
        cartCount.classList.toggle('show', count > 0);
    }
}

// Update wishlist count
function updateWishlistCount() {
    if (wishlistCountElement) {
        wishlistCountElement.textContent = wishlist.length;
        wishlistCountElement.classList.toggle('show', wishlist.length > 0);
    }
}

// Render cart
function renderCart() {
    if (!cartItems || !emptyCart || !cartTotal) return;
    
    if (cart.length === 0) {
        emptyCart.style.display = 'block';
        cartItems.innerHTML = '';
        cartTotal.textContent = 'Total: $0';
        return;
    }
    
    emptyCart.style.display = 'none';
    let total = 0;
    
    cartItems.innerHTML = cart.map(item => {
        const itemTotal = item.price * (item.quantity || 1);
        total += itemTotal;
        const icon = getProductIcon(item.name);
        
        return `
            <div class="cart-item" data-testid="cart-item-${item.id}">
                <div class="cart-item-image">${icon}</div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn minus" data-id="${item.id}" data-testid="cart-minus-${item.id}">-</button>
                        <input type="number" class="quantity-input" value="${item.quantity || 1}" min="1" data-id="${item.id}" data-testid="cart-quantity-${item.id}">
                        <button class="quantity-btn plus" data-id="${item.id}" data-testid="cart-plus-${item.id}">+</button>
                    </div>
                    <button class="remove-item" data-id="${item.id}" data-testid="cart-remove-${item.id}">Remove</button>
                </div>
            </div>
        `;
    }).join('');
    
    cartTotal.textContent = `Total: $${total.toFixed(2)}`;
    
    // Attach event listeners
    cartItems.querySelectorAll('.quantity-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => updateCartQuantity(parseInt(btn.dataset.id), -1));
    });
    
    cartItems.querySelectorAll('.quantity-btn.plus').forEach(btn => {
        btn.addEventListener('click', () => updateCartQuantity(parseInt(btn.dataset.id), 1));
    });
    
    cartItems.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.id)));
    });
}

// Update cart quantity
function updateCartQuantity(productId, change) {
    const item = cart.find(c => c.id === productId);
    if (!item) return;
    
    item.quantity = (item.quantity || 1) + change;
    if (item.quantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(c => c.id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

// Render wishlist
function renderWishlist() {
    if (!wishlistItems) return;
    
    if (wishlist.length === 0) {
        wishlistItems.innerHTML = '<div class="empty-cart">Your wishlist is empty</div>';
        return;
    }
    
    wishlistItems.innerHTML = wishlist.map(item => {
        const icon = getProductIcon(item.name);
        const isInCart = cart.some(c => c.id === item.id);
        return `
            <div class="cart-item" data-testid="wishlist-item-${item.id}">
                <div class="cart-item-image">${icon}</div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                    <div class="wishlist-actions">
                        <button class="add-to-cart-btn ${isInCart ? 'in-cart' : ''}" data-id="${item.id}" data-testid="wishlist-add-cart-${item.id}">
                            ${isInCart ? 'In Cart' : 'Add to Cart'}
                        </button>
                        <button class="remove-item" data-id="${item.id}" data-testid="wishlist-remove-${item.id}">Remove</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    wishlistItems.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!token) {
                openAuthModal();
                return;
            }
            
            const productId = parseInt(btn.dataset.id);
            const product = wishlist.find(w => w.id === productId);
            if (product && !cart.some(c => c.id === productId)) {
                try {
                    const response = await fetch(`${API_BASE}/api/cart`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ product_id: productId, quantity: 1 })
                    });
                    
                    if (response.ok) {
                        cart.push({ ...product, quantity: 1 });
                        localStorage.setItem('cart', JSON.stringify(cart));
                        updateCartCount();
                        renderCart();
                        renderWishlist();
                    }
                } catch (error) {
                    cart.push({ ...product, quantity: 1 });
                    localStorage.setItem('cart', JSON.stringify(cart));
                    updateCartCount();
                    renderCart();
                    renderWishlist();
                }
            }
        });
    });
    
    wishlistItems.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            wishlist = wishlist.filter(w => w.id !== parseInt(btn.dataset.id));
            localStorage.setItem('wishlist', JSON.stringify(wishlist));
            updateWishlistCount();
            renderWishlist();
        });
    });
}

// Open auth modal
function openAuthModal() {
    if (authModal) {
        authModal.classList.add('active');
    }
}

// Close auth modal
function closeAuthModal() {
    if (authModal) {
        authModal.classList.remove('active');
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            token = data.access_token;
            localStorage.setItem('token', token);
            
            // Get user info
            const meResponse = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (meResponse.ok) {
                currentUser = await meResponse.json();
                localStorage.setItem('user', JSON.stringify(currentUser));
                updateUserUI();
                closeAuthModal();
                
                // Sync cart with server
                await syncCart();
            }
        } else {
            const error = await response.json();
            errorEl.textContent = error.detail || 'Login failed';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        console.error('Login error:', err);
        errorEl.textContent = 'Connection failed. Please try again.';
        errorEl.style.display = 'block';
    }
}

// Handle register
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        if (response.ok) {
            // Auto login after registration
            const loginResponse = await fetch(`${API_BASE}/api/auth/login/json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (loginResponse.ok) {
                const data = await loginResponse.json();
                token = data.access_token;
                localStorage.setItem('token', token);
                
                const meResponse = await fetch(`${API_BASE}/api/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (meResponse.ok) {
                    currentUser = await meResponse.json();
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    updateUserUI();
                    closeAuthModal();
                }
            }
        } else {
            const error = await response.json();
            errorEl.textContent = error.detail || 'Registration failed';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        console.error('Register error:', err);
        errorEl.textContent = 'Connection failed. Please try again.';
        errorEl.style.display = 'block';
    }
}

// Sync local cart with server
async function syncCart() {
    if (!token) return;
    
    try {
        // Get server cart
        const response = await fetch(`${API_BASE}/api/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const serverCart = await response.json();
            
            // Merge with local cart
            for (const item of cart) {
                const serverItem = serverCart.find(s => s.product_id === item.id);
                if (!serverItem) {
                    // Add local item to server
                    await fetch(`${API_BASE}/api/cart`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ product_id: item.id, quantity: item.quantity || 1 })
                    });
                }
            }
            
            // Update local cart from server
            cart = serverCart.map(item => ({
                id: item.product_id,
                name: item.product.name,
                price: item.product.price,
                quantity: item.quantity,
                ...item.product
            }));
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            renderCart();
        }
    } catch (err) {
        console.error('Cart sync error:', err);
    }
}

// Update user UI
function updateUserUI() {
    if (currentUser) {
        if (signinBtn) signinBtn.style.display = 'none';
        if (userMenu) {
            userMenu.classList.add('show');
            if (userEmail) userEmail.textContent = currentUser.email;
        }
    } else {
        if (signinBtn) signinBtn.style.display = 'block';
        if (userMenu) userMenu.classList.remove('show');
    }
}

// Handle sign out
function handleSignOut() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    cart = [];
    localStorage.removeItem('cart');
    updateCartCount();
    renderCart();
    updateUserUI();
}

// Checkout
async function handleCheckout() {
    if (!token) {
        openAuthModal();
        return;
    }
    
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    try {
        // Create order and get Stripe checkout URL
        const response = await fetch(`${API_BASE}/api/checkout/create-session`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity || 1
                }))
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.checkout_url) {
                // Redirect to Stripe checkout
                window.location.href = data.checkout_url;
            } else {
                // Fallback if no Stripe - create order directly
                const orderResponse = await fetch(`${API_BASE}/api/orders`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (orderResponse.ok) {
                    const order = await orderResponse.json();
                    alert(`Order #${order.id} placed successfully! Total: $${order.total.toFixed(2)}`);
                    
                    // Clear cart
                    cart = [];
                    localStorage.removeItem('cart');
                    updateCartCount();
                    renderCart();
                    
                    // Close cart sidebar
                    if (cartSidebar) cartSidebar.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    
                    // Refresh products
                    await fetchProducts();
                    const productsGrid = document.getElementById('productsGrid');
                    const bestsellersGrid = document.getElementById('bestsellersGrid');
                    const bodyHairGrid = document.getElementById('bodyHairGrid');
                    
                    if (productsGrid) await renderProducts('productsGrid');
                    if (bestsellersGrid) await renderProducts('bestsellersGrid', p => p.categories.includes('skincare') || p.categories.includes('serums'));
                    if (bodyHairGrid) await renderProducts('bodyHairGrid', p => p.categories.some(c => c.includes('body') || c.includes('hair')));
                }
            }
        } else {
            const error = await response.json();
            alert(error.detail || 'Checkout failed');
        }
    } catch (err) {
        console.error('Checkout error:', err);
        alert('Checkout failed. Please try again.');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load products
    await fetchProducts();
    
    // Render products based on page
    const productsGrid = document.getElementById('productsGrid');
    const bestsellersGrid = document.getElementById('bestsellersGrid');
    const bodyHairGrid = document.getElementById('bodyHairGrid');
    
    // Check URL for category filter
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    
    if (productsGrid) {
        if (category) {
            document.getElementById('shopTitle').textContent = category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' + ');
            await renderProducts('productsGrid', p => p.categories.some(c => c.includes(category)));
        } else {
            await renderProducts('productsGrid');
        }
    }
    
    if (bestsellersGrid) {
        await renderProducts('bestsellersGrid', p => p.categories.includes('skincare') || p.categories.includes('serums'));
    }
    
    if (bodyHairGrid) {
        await renderProducts('bodyHairGrid', p => p.categories.some(c => c.includes('body') || c.includes('hair')));
    }
    
    // Check for saved user
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
        currentUser = JSON.parse(savedUser);
        updateUserUI();
    }
    
    updateCartCount();
    updateWishlistCount();
    
    // Cart sidebar
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            renderCart();
            if (cartSidebar) cartSidebar.classList.add('active');
            if (overlay) overlay.classList.add('active');
        });
    }
    
    const closeCart = document.getElementById('closeCart');
    if (closeCart) {
        closeCart.addEventListener('click', () => {
            if (cartSidebar) cartSidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        });
    }
    
    // Wishlist sidebar
    if (wishlistBtn) {
        wishlistBtn.addEventListener('click', () => {
            renderWishlist();
            if (wishlistSidebar) wishlistSidebar.classList.add('active');
            if (overlay) overlay.classList.add('active');
        });
    }
    
    const closeWishlist = document.getElementById('closeWishlist');
    if (closeWishlist) {
        closeWishlist.addEventListener('click', () => {
            if (wishlistSidebar) wishlistSidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        });
    }
    
    // Overlay click
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (cartSidebar) cartSidebar.classList.remove('active');
            if (wishlistSidebar) wishlistSidebar.classList.remove('active');
            overlay.classList.remove('active');
            closeAuthModal();
        });
    }
    
    // Sign in button
    if (signinBtn) {
        signinBtn.addEventListener('click', openAuthModal);
    }
    
    // Footer sign in
    const footerSignIn = document.getElementById('footerSignIn');
    if (footerSignIn) {
        footerSignIn.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal();
        });
    }
    
    // Close auth modal
    if (closeAuth) {
        closeAuth.addEventListener('click', closeAuthModal);
    }
    
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            
            tab.classList.add('active');
            const formId = tab.dataset.tab === 'login' ? 'loginForm' : 'registerForm';
            document.getElementById(formId).classList.add('active');
        });
    });
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Sign out
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
    }
    
    // Checkout
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }
    
    // Newsletter form
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showSubscriptionModal();
            newsletterForm.reset();
        });
    }
});

// Show subscription success modal
function showSubscriptionModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('subscriptionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'subscriptionModal';
        modal.className = 'subscription-modal';
        modal.innerHTML = `
            <div class="subscription-modal-content">
                <button class="subscription-modal-close" data-testid="close-subscription-modal">&times;</button>
                <div class="subscription-icon">✉️</div>
                <h3>Hello,</h3>
                <p>You have successfully subscribed to The Huck's exclusive deals and offers. We'll keep you updated.</p>
                <p>Thank you for joining us.</p>
                <div class="subscription-signature">- The Huckberry Team -</div>
                <button class="btn subscription-close-btn" data-testid="subscription-ok-btn">Got it!</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close button handlers
        modal.querySelector('.subscription-modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        modal.querySelector('.subscription-close-btn').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
    
    modal.classList.add('active');
}
