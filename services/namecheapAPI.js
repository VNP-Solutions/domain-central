const axios = require('axios');

class NamecheapAPI {
    constructor() {
        this.apiUser = process.env.NAMECHEAP_API_USER;
        this.apiKey = process.env.NAMECHEAP_API_KEY;
        this.clientIp = process.env.NAMECHEAP_CLIENT_IP;
        this.sandbox = process.env.NAMECHEAP_SANDBOX === 'true';
        this.baseURL = 'https://api.namecheap.com/xml.response';
    }

    // Build common parameters for API requests
    buildParams(command, additionalParams = {}) {
        return {
            ApiUser: this.apiUser,
            ApiKey: this.apiKey,
            UserName: this.apiUser,
            ClientIp: this.clientIp,
            Command: command,
            ...additionalParams
        };
    }

    // Make API request
    async makeRequest(command, params = {}) {
        try {
            const requestParams = this.buildParams(command, params);
            
            const response = await axios.get(this.baseURL, {
                params: requestParams,
                timeout: 30000
            });

            // Parse XML response (simplified - in production, use xml2js)
            const xmlData = response.data;
            
            // Check for API errors
            if (xmlData.includes('<Status>ERROR</Status>')) {
                const errorMatch = xmlData.match(/<Description>(.*?)<\/Description>/);
                const errorMessage = errorMatch ? errorMatch[1] : 'Unknown API error';
                throw new Error(`Namecheap API Error: ${errorMessage}`);
            }

            return xmlData;
        } catch (error) {
            console.error('Namecheap API request failed:', error.message);
            throw error;
        }
    }

    // Check domain availability
    async checkDomainAvailability(domain) {
        try {
            const response = await this.makeRequest('namecheap.domains.check', {
                DomainList: domain
            });

            console.log('--------------------------------');
            console.log(this.apiKey);
            console.log('--------------------------------');
            console.log(response);

            // Parse availability from XML response
            const availableMatch = response.match(new RegExp(`Domain="${domain}"[^>]*Available="([^"]*)"`, 'i'));
            const available = availableMatch ? availableMatch[1] === 'true' : false;
            
            // Check for premium pricing in the availability response
            let premiumPrice = null;
            const premiumPriceMatch = response.match(new RegExp(`Domain="${domain}"[^>]*PremiumRegistrationPrice="([^"]*)"`, 'i'));
            if (premiumPriceMatch && premiumPriceMatch[1] && premiumPriceMatch[1] !== '0') {
                premiumPrice = parseFloat(premiumPriceMatch[1]);
            }
            
            return { available, premiumPrice };
        } catch (error) {
            throw new Error(`Failed to check domain availability: ${error.message}`);
        }
    }

    // Get domain pricing
    async getDomainPricing(domain) {
        try {
            const tld = domain.split('.').pop().toLowerCase(); // Changed to lowercase to match XML response
            const response = await this.makeRequest('namecheap.users.getPricing', {
                ProductType: 'DOMAIN',
                ProductCategory: 'DOMAINS',
                ActionName: 'REGISTER',
                ProductName: tld.toUpperCase() // API expects uppercase
            });

            console.log('----------  PRICING REQUEST -------------');
            console.log(response);
            console.log('--------------------------------');
            console.log(`Looking for TLD: ${tld}`);

            // Parse pricing from XML response - look for the registration price
            // The actual response structure is: <ProductType Name="domains"> (lowercase)
            const productTypeMatch = response.match(/<ProductType[^>]*Name="domains"[^>]*>(.*?)<\/ProductType>/s);
            console.log('ProductType match:', !!productTypeMatch);
            
            if (productTypeMatch) {
                const domainSection = productTypeMatch[1];
                
                // Look for the register category (lowercase)
                const categoryPattern = new RegExp(`<ProductCategory[^>]*Name="register"[^>]*>(.*?)</ProductCategory>`, 's');
                const categoryMatch = domainSection.match(categoryPattern);
                console.log('Category match:', !!categoryMatch);
                
                if (categoryMatch) {
                    const registerSection = categoryMatch[1];
                    // Look for the specific TLD product (case-insensitive)
                    const productPattern = new RegExp(`<Product[^>]*Name="${tld}"[^>]*>(.*?)</Product>`, 'si');
                    const productMatch = registerSection.match(productPattern);
                    console.log('Product match:', !!productMatch);
                    
                    if (productMatch) {
                        const productSection = productMatch[1];
                        // Extract the entire Price tag for Duration="1"
                        const priceTagMatch = productSection.match(/<Price[^>]*Duration="1"[^>]*\/>/);
                        console.log('Price tag match:', !!priceTagMatch);
                        if (priceTagMatch) {
                            const priceTag = priceTagMatch[0];
                            console.log('Full price tag:', priceTag);
                            // Now extract the main Price attribute (not PromotionPrice)
                            const priceMatch = priceTag.match(/\bPrice="([^"]*)"/);
                            console.log('Price match:', !!priceMatch, priceMatch ? priceMatch[1] : 'N/A');
                            if (priceMatch) {
                                const price = parseFloat(priceMatch[1]);
                                console.log('Returning price:', price);
                                return price;
                            }
                        }
                    }
                }
            }
            
            // Fallback: Extract any Duration="1" price tag
            const fallbackTagMatch = response.match(/<Price[^>]*Duration="1"[^>]*\/>/);
            console.log('Fallback tag match:', !!fallbackTagMatch);
            if (fallbackTagMatch) {
                const priceTag = fallbackTagMatch[0];
                console.log('Fallback price tag:', priceTag);
                const priceMatch = priceTag.match(/\bPrice="([^"]*)"/);
                console.log('Fallback price match:', !!priceMatch, priceMatch ? priceMatch[1] : 'N/A');
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1]);
                    console.log('Returning fallback price:', price);
                    return price;
                }
            }
            
            console.log('No pricing found, returning 0');
            return 0;
        } catch (error) {
            throw new Error(`Failed to get domain pricing: ${error.message}`);
        }
    }

    // Purchase domain
    async purchaseDomain(domain, years = 1) {
        try {
            const response = await this.makeRequest('namecheap.domains.create', {
                DomainName: domain,
                Years: years,
                // Add default contact information (you should customize this)
                AuxBillingFirstName: 'Default',
                AuxBillingLastName: 'User',
                AuxBillingAddress1: '123 Main St',
                AuxBillingCity: 'Anytown',
                AuxBillingStateProvince: 'CA',
                AuxBillingPostalCode: '12345',
                AuxBillingCountry: 'US',
                AuxBillingPhone: '+1.1234567890',
                AuxBillingEmailAddress: 'admin@example.com',
                TechFirstName: 'Default',
                TechLastName: 'User',
                TechAddress1: '123 Main St',
                TechCity: 'Anytown',
                TechStateProvince: 'CA',
                TechPostalCode: '12345',
                TechCountry: 'US',
                TechPhone: '+1.1234567890',
                TechEmailAddress: 'admin@example.com',
                AdminFirstName: 'Default',
                AdminLastName: 'User',
                AdminAddress1: '123 Main St',
                AdminCity: 'Anytown',
                AdminStateProvince: 'CA',
                AdminPostalCode: '12345',
                AdminCountry: 'US',
                AdminPhone: '+1.1234567890',
                AdminEmailAddress: 'admin@example.com',
                RegistrantFirstName: 'Default',
                RegistrantLastName: 'User',
                RegistrantAddress1: '123 Main St',
                RegistrantCity: 'Anytown',
                RegistrantStateProvince: 'CA',
                RegistrantPostalCode: '12345',
                RegistrantCountry: 'US',
                RegistrantPhone: '+1.1234567890',
                RegistrantEmailAddress: 'admin@example.com'
            });

            console.log('----------  DOMAIN PURCHASE REQUEST -------------');
            console.log(response);
            console.log('--------------------------------');

            // Parse domain ID from response
            const domainIdMatch = response.match(/<DomainID>([^<]*)<\/DomainID>/);
            return {
                success: true,
                domainId: domainIdMatch ? domainIdMatch[1] : null,
                domain: domain
            };
        } catch (error) {
            throw new Error(`Failed to purchase domain: ${error.message}`);
        }
    }

    // Get list of domains
    async getDomainList() {
        try {
            const response = await this.makeRequest('namecheap.domains.getList');
            
            // Parse domains from XML response (simplified)
            const domainMatches = response.match(/<Domain[^>]*>/g) || [];
            const domains = domainMatches.map(match => {
                const nameMatch = match.match(/Name="([^"]*)"/);
                const createdMatch = match.match(/Created="([^"]*)"/);
                const expiresMatch = match.match(/Expires="([^"]*)"/);
                const autoRenewMatch = match.match(/AutoRenew="([^"]*)"/);
                
                return {
                    name: nameMatch ? nameMatch[1] : '',
                    created: createdMatch ? createdMatch[1] : '',
                    expires: expiresMatch ? expiresMatch[1] : '',
                    autoRenew: autoRenewMatch ? autoRenewMatch[1] === 'true' : false
                };
            });

            return domains;
        } catch (error) {
            throw new Error(`Failed to get domain list: ${error.message}`);
        }
    }

    // Get domain info
    async getDomainInfo(domain) {
        try {
            const response = await this.makeRequest('namecheap.domains.getInfo', {
                DomainName: domain
            });

            // Parse domain info from XML response (simplified)
            return {
                domain: domain,
                status: 'active', // Parse from response
                nameservers: [], // Parse from response
                createdDate: null, // Parse from response
                expirationDate: null // Parse from response
            };
        } catch (error) {
            throw new Error(`Failed to get domain info: ${error.message}`);
        }
    }
}

module.exports = new NamecheapAPI();
