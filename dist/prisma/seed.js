"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const ARTISANS = [
    {
        name: 'Adaobi Nwosu',
        email: 'adaobi@moe-marketplace.com',
        phone: '+2348012345001',
        avatar: 'https://source.unsplash.com/200x200?woman,african,fashion',
        business: {
            businessName: 'Adaobi Couture',
            description: 'Premium Ankara and lace designs for modern African women. Specializing in aso-ebi, cocktail dresses, and bespoke formal wear.',
            category: 'Fashion',
            location: 'Lekki, Lagos',
            heroImage: 'https://source.unsplash.com/1000x400?african,fashion,tailoring',
            images: ['https://source.unsplash.com/600x400?ankara,dress', 'https://source.unsplash.com/600x400?lace,fashion', 'https://source.unsplash.com/600x400?african,couture'],
        },
        products: [
            { name: 'Ankara Midi Dress', description: 'Vibrant Ankara print midi dress with fitted bodice and flared skirt.', category: 'tailoring', priceMin: 25000, priceMax: 45000, materials: 'Premium Ankara Fabric', estimatedDeliveryDays: 7, images: ['https://source.unsplash.com/400x400?ankara,midi,dress'], tags: ['Ankara', 'Modern', 'Casual'] },
            { name: 'Lace Aso-Ebi Set', description: 'Elegant French lace aso-ebi blouse and wrapper set with handmade beadwork.', category: 'tailoring', priceMin: 65000, priceMax: 120000, materials: 'French Lace, Beads', estimatedDeliveryDays: 14, images: ['https://source.unsplash.com/400x400?lace,wedding,dress'], tags: ['Lace', 'Wedding', 'Luxury'] },
            { name: 'Corporate Kaftan', description: 'Sophisticated senator-style kaftan for professional settings.', category: 'tailoring', priceMin: 35000, priceMax: 55000, materials: 'Italian Cashmere', estimatedDeliveryDays: 5, images: ['https://source.unsplash.com/400x400?kaftan,corporate,fashion'], tags: ['Corporate', 'Formal', 'Premium'] },
            { name: 'Custom Agbada Set', description: 'Full 3-piece agbada set with elaborate embroidery for special occasions.', category: 'tailoring', priceMin: 85000, priceMax: 150000, materials: 'Guinea Brocade, Thread', estimatedDeliveryDays: 21, images: ['https://source.unsplash.com/400x400?agbada,traditional,african'], tags: ['Traditional', 'Luxury', 'Wedding'] },
        ],
    },
    {
        name: 'Emeka Okafor',
        email: 'emeka@moe-marketplace.com',
        phone: '+2348012345002',
        avatar: 'https://source.unsplash.com/200x200?man,african,craftsman',
        business: {
            businessName: 'Emeka Leather Crafts',
            description: 'Handcrafted leather goods — shoes, bags, belts, and accessories made from locally sourced Nigerian leather.',
            category: 'Crafts',
            location: 'Aba, Abia',
            heroImage: 'https://source.unsplash.com/1000x400?leather,crafts,handmade',
            images: ['https://source.unsplash.com/600x400?leather,shoes', 'https://source.unsplash.com/600x400?leather,bag', 'https://source.unsplash.com/600x400?leather,craft'],
        },
        products: [
            { name: 'Classic Oxford Shoes', description: 'Hand-stitched Oxford shoes with Goodyear welt construction.', category: 'shoemaking', priceMin: 45000, priceMax: 75000, materials: 'Full-grain Leather', estimatedDeliveryDays: 14, images: ['https://source.unsplash.com/400x400?oxford,shoes,leather'], tags: ['Formal', 'Handmade', 'Premium'] },
            { name: 'Leather Laptop Bag', description: 'Spacious leather messenger bag with padded laptop compartment.', category: 'leatherwork', priceMin: 35000, priceMax: 55000, materials: 'Full-grain Leather, Brass Hardware', estimatedDeliveryDays: 10, images: ['https://source.unsplash.com/400x400?laptop,bag,leather'], tags: ['Corporate', 'Handmade'] },
            { name: 'Handmade Belt', description: 'Classic leather belt with hand-tooled design and solid brass buckle.', category: 'leatherwork', priceMin: 12000, priceMax: 18000, materials: 'Vegetable-tanned Leather', estimatedDeliveryDays: 5, images: ['https://source.unsplash.com/400x400?leather,belt,vintage'], tags: ['Casual', 'Handmade'] },
            { name: 'Chelsea Boots', description: 'Rugged yet elegant Chelsea boots with elastic side panels.', category: 'shoemaking', priceMin: 55000, priceMax: 85000, materials: 'Full-grain Leather, Rubber Sole', estimatedDeliveryDays: 14, images: ['https://source.unsplash.com/400x400?chelsea,boots,leather'], tags: ['Casual', 'Premium', 'Handmade'] },
        ],
    },
    {
        name: 'Fatima Bello',
        email: 'fatima@moe-marketplace.com',
        phone: '+2348012345003',
        avatar: 'https://source.unsplash.com/200x200?woman,african,artist',
        business: {
            businessName: 'Fatima Arts Studio',
            description: 'Contemporary African art and canvas paintings celebrating Nigerian culture, landscapes, and modern life.',
            category: 'Crafts',
            location: 'Abuja, FCT',
            heroImage: 'https://source.unsplash.com/1000x400?art,painting,african',
            images: ['https://source.unsplash.com/600x400?canvas,art,african', 'https://source.unsplash.com/600x400?contemporary,art', 'https://source.unsplash.com/600x400?painting,gallery'],
        },
        products: [
            { name: 'Lagos Skyline Canvas', description: 'Large-format acrylic painting of the Lagos skyline at sunset.', category: 'canvas', priceMin: 75000, priceMax: 120000, materials: 'Acrylic on Canvas', estimatedDeliveryDays: 7, images: ['https://source.unsplash.com/400x400?skyline,sunset,painting'], tags: ['Modern', 'Afrocentric'] },
            { name: 'Village Market Portrait', description: 'Vibrant oil painting depicting a traditional Nigerian market scene.', category: 'canvas', priceMin: 55000, priceMax: 90000, materials: 'Oil on Canvas', estimatedDeliveryDays: 10, images: ['https://source.unsplash.com/400x400?market,africa,painting'], tags: ['Traditional', 'Afrocentric'] },
            { name: 'Abstract Unity', description: 'Abstract piece representing Nigerian unity through bold geometric shapes.', category: 'canvas', priceMin: 40000, priceMax: 65000, materials: 'Mixed Media on Canvas', estimatedDeliveryDays: 7, images: ['https://source.unsplash.com/400x400?abstract,art,modern'], tags: ['Modern', 'Elegant'] },
            { name: 'Custom Family Portrait', description: 'Commission a personalized family portrait in watercolor or acrylic.', category: 'canvas', priceMin: 100000, priceMax: 200000, materials: 'Watercolor/Acrylic on Canvas', estimatedDeliveryDays: 21, images: ['https://source.unsplash.com/400x400?portrait,family,art'], tags: ['Custom Fit', 'Luxury'] },
        ],
    },
    {
        name: 'Chidinma Eze',
        email: 'chidinma@moe-marketplace.com',
        phone: '+2348012345004',
        avatar: 'https://source.unsplash.com/200x200?woman,african,jewelry',
        business: {
            businessName: 'Chidinma Beads & Jewelry',
            description: 'Handcrafted beaded jewelry and accessories using authentic African beads, coral, and semi-precious stones.',
            category: 'Jewelry',
            location: 'Port Harcourt, Rivers',
            heroImage: 'https://source.unsplash.com/1000x400?jewelry,beads,african',
            images: ['https://source.unsplash.com/600x400?jewelry,beads', 'https://source.unsplash.com/600x400?necklace,handmade', 'https://source.unsplash.com/600x400?jewelry,traditional'],
        },
        products: [
            { name: 'Coral Bead Necklace', description: 'Traditional coral bead necklace with gold accent clasps.', category: 'crafts', priceMin: 25000, priceMax: 45000, materials: 'Natural Coral Beads, Gold Plating', estimatedDeliveryDays: 5, images: ['https://source.unsplash.com/400x400?coral,necklace,beads'], tags: ['Traditional', 'Luxury', 'Wedding'] },
            { name: 'Ankara Earrings Set', description: 'Lightweight Ankara-wrapped hoop earrings in assorted prints.', category: 'crafts', priceMin: 5000, priceMax: 8000, materials: 'Ankara Fabric, Metal Frame', estimatedDeliveryDays: 3, images: ['https://source.unsplash.com/400x400?earrings,hoop,colorful'], tags: ['Ankara', 'Casual', 'Modern'] },
            { name: 'Bridal Jewelry Set', description: 'Complete bridal set: necklace, earrings, bracelet, and tiara with crystals and pearls.', category: 'crafts', priceMin: 85000, priceMax: 150000, materials: 'Crystals, Pearls, Gold Plating', estimatedDeliveryDays: 14, images: ['https://source.unsplash.com/400x400?bridal,jewelry,crystals'], tags: ['Wedding', 'Luxury', 'Elegant'] },
            { name: 'Waist Beads', description: 'Traditional African waist beads in custom colors and patterns.', category: 'crafts', priceMin: 3000, priceMax: 8000, materials: 'Glass Beads, Elastic Thread', estimatedDeliveryDays: 3, images: ['https://source.unsplash.com/400x400?waist,beads,traditional'], tags: ['Traditional', 'Afrocentric', 'Casual'] },
        ],
    },
    {
        name: 'Oluwaseun Adeyemi',
        email: 'seun@moe-marketplace.com',
        phone: '+2348012345005',
        avatar: 'https://source.unsplash.com/200x200?man,african,furniture',
        business: {
            businessName: 'Seun Woodworks',
            description: 'Custom furniture and home décor crafted from reclaimed Nigerian hardwoods. Each piece tells a story.',
            category: 'Furniture',
            location: 'Ibadan, Oyo',
            heroImage: 'https://source.unsplash.com/1000x400?furniture,wood,crafted',
            images: ['https://source.unsplash.com/600x400?wooden,furniture', 'https://source.unsplash.com/600x400?handmade,table,wood', 'https://source.unsplash.com/600x400?interior,wood,design'],
        },
        products: [
            { name: 'Reclaimed Wood Dining Table', description: 'Six-seater dining table from reclaimed iroko wood with hairpin legs.', category: 'crafts', priceMin: 120000, priceMax: 200000, materials: 'Reclaimed Iroko Wood, Steel Legs', estimatedDeliveryDays: 21, images: ['https://source.unsplash.com/400x400?dining,table,wood,luxury'], tags: ['Handmade', 'Premium', 'Modern'] },
            { name: 'African Stool', description: 'Hand-carved decorative stool inspired by traditional Yoruba designs.', category: 'crafts', priceMin: 35000, priceMax: 55000, materials: 'Mahogany Wood', estimatedDeliveryDays: 14, images: ['https://source.unsplash.com/400x400?wooden,stool,traditional'], tags: ['Traditional', 'Handmade', 'Afrocentric'] },
            { name: 'Floating Shelf Set', description: 'Set of 3 floating shelves in different sizes, walnut finish.', category: 'crafts', priceMin: 18000, priceMax: 30000, materials: 'Treated Pine Wood', estimatedDeliveryDays: 7, images: ['https://source.unsplash.com/400x400?floating,shelf,wood'], tags: ['Modern', 'Casual'] },
            { name: 'Custom Bookshelf', description: 'Floor-to-ceiling custom bookshelf with adjustable compartments.', category: 'crafts', priceMin: 85000, priceMax: 140000, materials: 'Hardwood, Metal Brackets', estimatedDeliveryDays: 28, images: ['https://source.unsplash.com/400x400?bookshelf,wood,custom'], tags: ['Custom Fit', 'Premium', 'Modern'] },
        ],
    },
];
const ADMIN_ACCOUNTS = [
    { name: 'Admin User', email: 'asukuonukaba@gmail.com' },
    { name: 'Admin User', email: 'tayuzeee@gmail.com' },
    { name: 'Admin User', email: 'Smartlynks97@gmail.com' },
];
async function main() {
    console.log('🌱 Seeding marketplace data...');
    await prisma.role.upsert({
        where: { name: 'artisan' },
        update: {},
        create: { name: 'artisan' },
    });
    await prisma.role.upsert({
        where: { name: 'customer' },
        update: {},
        create: { name: 'customer' },
    });
    await prisma.role.upsert({
        where: { name: 'admin' },
        update: {},
        create: { name: 'admin' },
    });
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    if (!adminRole)
        throw new Error('admin role missing after upsert');
    const adminPassword = await bcrypt.hash('password123', 12);
    for (const admin of ADMIN_ACCOUNTS) {
        const email = admin.email.toLowerCase();
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: admin.name,
                    email,
                    passwordHash: adminPassword,
                },
            });
            console.log(`  ✅ Created admin: ${email}`);
        }
        else {
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: adminPassword },
            });
            console.log(`  ✅ Ensured admin password for existing user: ${email}`);
        }
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
            update: {},
            create: { userId: user.id, roleId: adminRole.id },
        });
    }
    for (const artisan of ARTISANS) {
        const hashedPassword = await bcrypt.hash('Password123!', 12);
        const user = await prisma.user.create({
            data: {
                name: artisan.name,
                email: artisan.email,
                passwordHash: hashedPassword,
                phone: artisan.phone,
                avatarUrl: artisan.avatar,
            },
        });
        const artisanRole = await prisma.role.findUnique({
            where: { name: 'artisan' },
        });
        if (artisanRole) {
            await prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: artisanRole.id,
                },
            });
        }
        await prisma.artisanProfile.create({
            data: {
                userId: user.id,
                businessName: artisan.business.businessName,
                description: artisan.business.description,
                category: artisan.business.category,
                location: artisan.business.location,
                heroImage: artisan.business.heroImage,
                images: artisan.business.images,
                rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
                verified: true,
                status: 'approved',
                products: {
                    create: artisan.products.map((p) => ({
                        name: p.name,
                        description: p.description,
                        category: p.category,
                        price: p.priceMin,
                        originalPrice: p.priceMax,
                        currency: 'NGN',
                        materials: p.materials,
                        estimatedDeliveryDays: p.estimatedDeliveryDays,
                        images: p.images,
                        tags: p.tags.join(','),
                        status: 'approved',
                        providerId: user.id,
                    })),
                },
            },
        });
        console.log(`  ✅ Created artisan: ${artisan.name} (${artisan.business.businessName})`);
    }
    console.log(`\n🎉 Seeding complete! Created ${ARTISANS.length} artisans with ${ARTISANS.length * 4} products.`);
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map