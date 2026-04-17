import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

// ===============================================
// TEST CREDENTIALS FOR LOCAL DEVELOPMENT
// ===============================================
// Artisan Accounts (Password: Password123!)
//   adaobi@moe.com    (Adaobi Couture - Tailoring)
//   emeka@moe.com     (Emeka Leather Crafts - Leatherwork)
//   fatima@moe.com    (Fatima Arts Studio - Canvas)
//   chidinma@moe.com  (Chidinma Beads & Jewelry - Jewelry)
//   seun@moe.com      (Seun Woodworks - Woodworking)
//
// Customer Accounts (Password: Password123!)
//   john@customer.com
//   jane@customer.com
//   ada@customer.com
// ===============================================

const prisma = new PrismaClient();

const ARTISANS = [
  {
    name: 'Adaobi Nwosu',
    email: 'adaobi@moe-marketplace.com',
    phone: '+2348012345001',
    business: {
      businessName: 'Adaobi Couture',
      description: 'Premium Ankara and lace designs for modern African women. Specializing in aso-ebi, cocktail dresses, and bespoke formal wear.',
      category: 'Fashion',
      location: 'Lekki, Lagos',
      images: ['https://picsum.photos/seed/adaobi1/600/400', 'https://picsum.photos/seed/adaobi2/600/400'],
    },
    products: [
      { name: 'Ankara Midi Dress', description: 'Vibrant Ankara print midi dress with fitted bodice and flared skirt.', category: 'tailoring', priceMin: 25000, priceMax: 45000, materials: 'Premium Ankara Fabric', estimatedDeliveryDays: 7, images: ['https://picsum.photos/seed/prod1/400/400'], tags: ['Ankara', 'Modern', 'Casual'] },
      { name: 'Lace Aso-Ebi Set', description: 'Elegant French lace aso-ebi blouse and wrapper set with handmade beadwork.', category: 'tailoring', priceMin: 65000, priceMax: 120000, materials: 'French Lace, Beads', estimatedDeliveryDays: 14, images: ['https://picsum.photos/seed/prod2/400/400'], tags: ['Lace', 'Wedding', 'Luxury'] },
      { name: 'Corporate Kaftan', description: 'Sophisticated senator-style kaftan for professional settings.', category: 'tailoring', priceMin: 35000, priceMax: 55000, materials: 'Italian Cashmere', estimatedDeliveryDays: 5, images: ['https://picsum.photos/seed/prod3/400/400'], tags: ['Corporate', 'Formal', 'Premium'] },
      { name: 'Custom Agbada Set', description: 'Full 3-piece agbada set with elaborate embroidery for special occasions.', category: 'tailoring', priceMin: 85000, priceMax: 150000, materials: 'Guinea Brocade, Thread', estimatedDeliveryDays: 21, images: ['https://picsum.photos/seed/prod4/400/400'], tags: ['Traditional', 'Luxury', 'Wedding'] },
    ],
  },
  {
    name: 'Emeka Okafor',
    email: 'emeka@moe-marketplace.com',
    phone: '+2348012345002',
    business: {
      businessName: 'Emeka Leather Crafts',
      description: 'Handcrafted leather goods — shoes, bags, belts, and accessories made from locally sourced Nigerian leather.',
      category: 'Crafts',
      location: 'Aba, Abia',
      images: ['https://picsum.photos/seed/emeka1/600/400', 'https://picsum.photos/seed/emeka2/600/400'],
    },
    products: [
      { name: 'Classic Oxford Shoes', description: 'Hand-stitched Oxford shoes with Goodyear welt construction.', category: 'shoemaking', priceMin: 45000, priceMax: 75000, materials: 'Full-grain Leather', estimatedDeliveryDays: 14, images: ['https://picsum.photos/seed/prod5/400/400'], tags: ['Formal', 'Handmade', 'Premium'] },
      { name: 'Leather Laptop Bag', description: 'Spacious leather messenger bag with padded laptop compartment.', category: 'leatherwork', priceMin: 35000, priceMax: 55000, materials: 'Full-grain Leather, Brass Hardware', estimatedDeliveryDays: 10, images: ['https://picsum.photos/seed/prod6/400/400'], tags: ['Corporate', 'Handmade'] },
      { name: 'Handmade Belt', description: 'Classic leather belt with hand-tooled design and solid brass buckle.', category: 'leatherwork', priceMin: 12000, priceMax: 18000, materials: 'Vegetable-tanned Leather', estimatedDeliveryDays: 5, images: ['https://picsum.photos/seed/prod7/400/400'], tags: ['Casual', 'Handmade'] },
      { name: 'Chelsea Boots', description: 'Rugged yet elegant Chelsea boots with elastic side panels.', category: 'shoemaking', priceMin: 55000, priceMax: 85000, materials: 'Full-grain Leather, Rubber Sole', estimatedDeliveryDays: 14, images: ['https://picsum.photos/seed/prod8/400/400'], tags: ['Casual', 'Premium', 'Handmade'] },
    ],
  },
  {
    name: 'Fatima Bello',
    email: 'fatima@moe-marketplace.com',
    phone: '+2348012345003',
    business: {
      businessName: 'Fatima Arts Studio',
      description: 'Contemporary African art and canvas paintings celebrating Nigerian culture, landscapes, and modern life.',
      category: 'Crafts',
      location: 'Abuja, FCT',
      images: ['https://picsum.photos/seed/fatima1/600/400'],
    },
    products: [
      { name: 'Lagos Skyline Canvas', description: 'Large-format acrylic painting of the Lagos skyline at sunset.', category: 'canvas', priceMin: 75000, priceMax: 120000, materials: 'Acrylic on Canvas', estimatedDeliveryDays: 7, images: ['https://picsum.photos/seed/prod9/400/400'], tags: ['Modern', 'Afrocentric'] },
      { name: 'Village Market Portrait', description: 'Vibrant oil painting depicting a traditional Nigerian market scene.', category: 'canvas', priceMin: 55000, priceMax: 90000, materials: 'Oil on Canvas', estimatedDeliveryDays: 10, images: ['https://picsum.photos/seed/prod10/400/400'], tags: ['Traditional', 'Afrocentric'] },
      { name: 'Abstract Unity', description: 'Abstract piece representing Nigerian unity through bold geometric shapes.', category: 'canvas', priceMin: 40000, priceMax: 65000, materials: 'Mixed Media on Canvas', estimatedDeliveryDays: 7, images: ['https://picsum.photos/seed/prod11/400/400'], tags: ['Modern', 'Elegant'] },
      { name: 'Custom Family Portrait', description: 'Commission a personalized family portrait in watercolor or acrylic.', category: 'canvas', priceMin: 100000, priceMax: 200000, materials: 'Watercolor/Acrylic on Canvas', estimatedDeliveryDays: 21, images: ['https://picsum.photos/seed/prod12/400/400'], tags: ['Custom Fit', 'Luxury'] },
    ],
  },
  {
    name: 'Chidinma Eze',
    email: 'chidinma@moe-marketplace.com',
    phone: '+2348012345004',
    business: {
      businessName: 'Chidinma Beads & Jewelry',
      description: 'Handcrafted beaded jewelry and accessories using authentic African beads, coral, and semi-precious stones.',
      category: 'Jewelry',
      location: 'Port Harcourt, Rivers',
      images: ['https://picsum.photos/seed/chidi1/600/400', 'https://picsum.photos/seed/chidi2/600/400'],
    },
    products: [
      { name: 'Coral Bead Necklace', description: 'Traditional coral bead necklace with gold accent clasps.', category: 'crafts', priceMin: 25000, priceMax: 45000, materials: 'Natural Coral Beads, Gold Plating', estimatedDeliveryDays: 5, images: ['https://picsum.photos/seed/prod13/400/400'], tags: ['Traditional', 'Luxury', 'Wedding'] },
      { name: 'Ankara Earrings Set', description: 'Lightweight Ankara-wrapped hoop earrings in assorted prints.', category: 'crafts', priceMin: 5000, priceMax: 8000, materials: 'Ankara Fabric, Metal Frame', estimatedDeliveryDays: 3, images: ['https://picsum.photos/seed/prod14/400/400'], tags: ['Ankara', 'Casual', 'Modern'] },
      { name: 'Bridal Jewelry Set', description: 'Complete bridal set: necklace, earrings, bracelet, and tiara with crystals and pearls.', category: 'crafts', priceMin: 85000, priceMax: 150000, materials: 'Crystals, Pearls, Gold Plating', estimatedDeliveryDays: 14, images: ['https://picsum.photos/seed/prod15/400/400'], tags: ['Wedding', 'Luxury', 'Elegant'] },
      { name: 'Waist Beads', description: 'Traditional African waist beads in custom colors and patterns.', category: 'crafts', priceMin: 3000, priceMax: 8000, materials: 'Glass Beads, Elastic Thread', estimatedDeliveryDays: 3, images: ['https://picsum.photos/seed/prod16/400/400'], tags: ['Traditional', 'Afrocentric', 'Casual'] },
    ],
  },
  {
    name: 'Oluwaseun Adeyemi',
    email: 'seun@moe-marketplace.com',
    phone: '+2348012345005',
    business: {
      businessName: 'Seun Woodworks',
      description: 'Custom furniture and home décor crafted from reclaimed Nigerian hardwoods. Each piece tells a story.',
      category: 'Furniture',
      location: 'Ibadan, Oyo',
      images: ['https://picsum.photos/seed/seun1/600/400'],
    },
    products: [
      { name: 'Reclaimed Wood Dining Table', description: 'Six-seater dining table from reclaimed iroko wood with hairpin legs.', category: 'crafts', priceMin: 120000, priceMax: 200000, materials: 'Reclaimed Iroko Wood, Steel Legs', estimatedDeliveryDays: 21, images: ['https://picsum.photos/seed/prod17/400/400'], tags: ['Handmade', 'Premium', 'Modern'] },
      { name: 'African Stool', description: 'Hand-carved decorative stool inspired by traditional Yoruba designs.', category: 'crafts', priceMin: 35000, priceMax: 55000, materials: 'Mahogany Wood', estimatedDeliveryDays: 14, images: ['https://picsum.photos/seed/prod18/400/400'], tags: ['Traditional', 'Handmade', 'Afrocentric'] },
      { name: 'Floating Shelf Set', description: 'Set of 3 floating shelves in different sizes, walnut finish.', category: 'crafts', priceMin: 18000, priceMax: 30000, materials: 'Treated Pine Wood', estimatedDeliveryDays: 7, images: ['https://picsum.photos/seed/prod19/400/400'], tags: ['Modern', 'Casual'] },
      { name: 'Custom Bookshelf', description: 'Floor-to-ceiling custom bookshelf with adjustable compartments.', category: 'crafts', priceMin: 85000, priceMax: 140000, materials: 'Hardwood, Metal Brackets', estimatedDeliveryDays: 28, images: ['https://picsum.photos/seed/prod20/400/400'], tags: ['Custom Fit', 'Premium', 'Modern'] },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding marketplace data...');

  // Ensure artisan role exists
  await prisma.role.upsert({
    where: { name: 'artisan' },
    update: {},
    create: { name: 'artisan' },
  });

  for (const artisan of ARTISANS) {
    const hashedPassword = await hash('Password123!', 12);

    const user = await prisma.user.create({
      data: {
        name: artisan.name,
        email: artisan.email,
        passwordHash: hashedPassword,
        phone: artisan.phone,
      },
    });

    // Assign artisan role
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

    // Create artisan profile and products
    await prisma.artisanProfile.create({
      data: {
        userId: user.id,
        businessName: artisan.business.businessName,
        description: artisan.business.description,
        category: artisan.business.category,
        location: artisan.business.location,
        images: artisan.business.images,
        rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
        verified: true,
        products: {
          create: artisan.products.map((p) => ({
            name: p.name,
            description: p.description,
            category: p.category,
            priceMin: p.priceMin,
            priceMax: p.priceMax,
            currency: 'NGN',
            materials: p.materials,
            estimatedDeliveryDays: p.estimatedDeliveryDays,
            images: p.images,
            tags: p.tags.join(','),
            status: 'ACTIVE',
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
