USE project1;

CREATE TABLE IF NOT EXISTS vendor_panel_accounts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    existing_vendor_id BIGINT NULL,
    business_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vendor_account_status (status),
    INDEX idx_existing_vendor (existing_vendor_id)
);

CREATE TABLE IF NOT EXISTS vendor_panel_leads (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor_id BIGINT NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(190) NULL,
    customer_phone VARCHAR(30) NULL,
    service_requested VARCHAR(200) NOT NULL,
    description TEXT NULL,
    status ENUM(
        'new',
        'contacted',
        'in_progress',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'new',
    lead_source VARCHAR(80) NULL DEFAULT 'website',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vendor_lead_created (vendor_id, created_at),
    INDEX idx_vendor_lead_status (vendor_id, status)
);

CREATE TABLE IF NOT EXISTS vendor_panel_profile_views (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor_id BIGINT NOT NULL,
    viewer_reference VARCHAR(150) NULL,
    viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_vendor_view_date (vendor_id, viewed_at)
);

CREATE TABLE IF NOT EXISTS vendor_panel_reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor_id BIGINT NOT NULL,
    customer_name VARCHAR(120) NULL,
    rating DECIMAL(2,1) NOT NULL,
    review_text TEXT NULL,
    status ENUM('pending', 'published', 'rejected')
        NOT NULL DEFAULT 'published',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_vendor_rating
        CHECK (rating >= 1.0 AND rating <= 5.0),

    INDEX idx_vendor_review_status (vendor_id, status)
);

CREATE TABLE IF NOT EXISTS vendor_panel_subscriptions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor_id BIGINT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    plan_code VARCHAR(50) NULL,
    plan_status ENUM('active', 'expired', 'cancelled', 'pending')
        NOT NULL DEFAULT 'active',
    starts_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vendor_subscription (
        vendor_id,
        plan_status,
        expires_at
    )
);

CREATE TABLE IF NOT EXISTS vendor_panel_verifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor_id BIGINT NOT NULL,
    verification_status ENUM(
        'not_submitted',
        'pending',
        'verified',
        'rejected'
    ) NOT NULL DEFAULT 'not_submitted',
    certificate_url VARCHAR(500) NULL,
    verified_at DATETIME NULL,
    expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_vendor_verification (vendor_id)
);