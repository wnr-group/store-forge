import { IndustriesMarquee, type IndustryCategory } from "./industries-marquee";
import { Fade, Wipe } from "./effects";
import { Container, Section } from "./ui";

/** Centralised category data. Add `image` to show a photo (a missing one shows "Image Coming Soon"). */
const CATEGORIES: IndustryCategory[] = [
  { name: "Electronics", text: "Gadgets, computers, smartphones and accessories.", image: "/landing/cat-electronics.webp", alt: "A laptop, smartphone, tablet, camera, headphones and smart speaker on a dark desk", position: "50% 50%" },
  { name: "Fashion & Clothing", text: "Apparel, footwear and fashion accessories.", image: "/landing/cat-fashion.webp", alt: "A blazer, folded shirts, jeans, suede shoes and a straw hat laid out on white", position: "50% 45%" },
  { name: "Medicine & Healthcare", text: "Pharmacy, wellness and healthcare products.", image: "/landing/cat-medicine.webp", alt: "Medicine bottles beside a miniature shopping cart filled with blister packs", position: "68% 50%" },
  { name: "Beauty & Skincare", text: "Cosmetics, skincare and personal care.", image: "/landing/cat-beauty.webp", alt: "Skincare serums and creams displayed on white pedestals against a purple backdrop", position: "50% 55%" },
  { name: "Groceries & Food", text: "Fresh produce, packaged food and daily essentials.", image: "/landing/cat-groceries.webp", alt: "Fresh vegetables, fruit, bread and packaged food arranged on a stone surface", position: "50% 50%" },
  { name: "Home & Furniture", text: "Furniture, home decor and household products.", image: "/landing/cat-home.webp", alt: "An upholstered chair beside a wooden stool with a glass lamp, in front of a wood-slat wall", position: "32% 50%" },
  { name: "Sports & Fitness", text: "Fitness equipment, sportswear and accessories.", image: "/landing/cat-sports.webp", alt: "Dumbbells, a foam block and a rolled yoga mat on a wooden floor", position: "55% 50%" },
  { name: "Toys & Lifestyle", text: "Toys, games and lifestyle products.", image: "/landing/cat-toys.webp", alt: "A plush unicorn, puzzles, a play tent and wooden toys on a light blue backdrop", position: "50% 50%" },
];

export function Industries() {
  return (
    <Section id="industries" className="overflow-hidden bg-white py-24 sm:py-32">
      <Container>
        <div className="grid items-end gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div>
            <Fade as="p" className="text-sm font-medium tracking-wide text-lp-primary">ONE PLATFORM, MANY POSSIBILITIES</Fade>
            <Wipe delay={0.1}>
            <h2 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-lp-heading sm:text-5xl lg:text-6xl">Built for every kind of business.</h2>
            </Wipe>
          </div>
          <Fade delay={0.4}>
            <p className="max-w-md text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">
              From electronics and fashion to healthcare and home essentials, StoreForge helps businesses organize their products, orders, inventory and everyday store operations in one place.
            </p>
          </Fade>
        </div>
      </Container>
      <Fade delay={0.3} duration={1.6} className="mt-10 sm:mt-14">
        <IndustriesMarquee categories={CATEGORIES} />
      </Fade>
    </Section>
  );
}
