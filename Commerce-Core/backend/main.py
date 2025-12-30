import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from routers import auth_router, products_router, cart_router, orders_router, admin_router, checkout_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="The Huckberry API",
    description="Luxury Skincare Ecommerce Backend",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for product images
static_dir = os.path.join(os.path.dirname(__file__), "static", "product_images")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# Include routers
app.include_router(auth_router.router)
app.include_router(products_router.router)
app.include_router(cart_router.router)
app.include_router(orders_router.router)
app.include_router(admin_router.router)
app.include_router(checkout_router.router)


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


# Seed initial admin user if not exists
@app.on_event("startup")
def seed_admin():
    from database import SessionLocal
    import models
    from auth import get_password_hash
    
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.role == "admin").first()
        if not admin:
            admin_user = models.User(
                email="admin@huckberry.com",
                username="admin",
                hashed_password=get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("Created default admin user: admin@huckberry.com / admin123")
    finally:
        db.close()


# Seed sample products if none exist
@app.on_event("startup")
def seed_products():
    from database import SessionLocal
    import models
    
    db = SessionLocal()
    try:
        product_count = db.query(models.Product).count()
        if product_count == 0:
            sample_products = [
                {
                    "name": "Botanical Face Oil",
                    "description": "A luxurious blend of botanical oils for radiant skin",
                    "price": 68.00,
                    "stock": 50,
                    "categories": ["skincare", "serums"]
                },
                {
                    "name": "Rose Water Toner",
                    "description": "Gentle, hydrating toner with pure rose water",
                    "price": 42.00,
                    "stock": 75,
                    "categories": ["skincare", "toners"]
                },
                {
                    "name": "Green Tea Cleanser",
                    "description": "Deep cleansing formula with antioxidant-rich green tea",
                    "price": 38.00,
                    "stock": 60,
                    "categories": ["skincare", "cleansers"]
                },
                {
                    "name": "Hydrating Serum",
                    "description": "Intensive hydration with hyaluronic acid",
                    "price": 72.00,
                    "stock": 40,
                    "categories": ["skincare", "serums"]
                },
                {
                    "name": "Lavender Body Oil",
                    "description": "Relaxing body oil infused with organic lavender",
                    "price": 52.00,
                    "stock": 55,
                    "categories": ["body-hair", "body"]
                },
                {
                    "name": "Charcoal Shampoo",
                    "description": "Detoxifying shampoo with activated charcoal",
                    "price": 28.00,
                    "stock": 80,
                    "categories": ["body-hair", "hair"]
                }
            ]
            
            for product_data in sample_products:
                product = models.Product(**product_data)
                db.add(product)
            
            db.commit()
            print(f"Created {len(sample_products)} sample products")
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
