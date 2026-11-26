import { IndustriesMarquee, type IndustryCategory } from "./industries-marquee";
import { Fade, Wipe } from "./effects";
import { Container, Section } from "./ui";

/** Centralised category data. Add `image` to show a photo (a missing one shows "Image Coming Soon"). */
const CATEGORIES: IndustryCategory[] = [
  { name: "Electronics", text: "Gadgets, computers, smartphones and accessories.", image: "/landing/industry-electronics.webp", alt: "A laptop, smartphone, tablet, camera, smartwatch, earbuds, headphones and smart speaker on a desk", position: "50% 50%" },
  { name: "Fashion & Clothing", text: "Apparel, footwear and fashion accessories.", image: "/landing/industry-fashion.webp", alt: "A rack of hoodies and jackets beside a leather backpack, sneakers, a cap, sunglasses and folded knitwear", position: "58% 50%" },
  { name: "Medicine & Healthcare", text: "Pharmacy, wellness and healthcare products.", image: "/landing/industry-medicine.webp", alt: "A first-aid kit, medicine bottles, tablets, a face mask, thermometer and stethoscope on a marble counter", position: "76% 50%" },
  { name: "Beauty & Skincare", text: "Cosmetics, skincare and personal care.", image: "/landing/industry-beauty.webp", alt: "Makeup brushes, lipstick, serums, creams and bottles beside a rolled towel and a pink rose", position: "52% 50%" },
  { name: "Groceries & Food", text: "Fresh produce, packaged food and daily essentials.", image: "/landing/industry-groceries.webp", alt: "A basket of fresh vegetables and fruit with bread, milk, eggs, pasta, lentils and oats", position: "50% 50%" },
  { name: "Home & Furniture", text: "Furniture, home decor and household products.", image: "/landing/industry-home.webp", alt: "A living room with a sofa, armchair, wooden coffee table, wall art, shelves and cushions", position: "50% 50%" },
  { name: "Sports & Fitness", text: "Fitness equipment, sportswear and accessories.", image: "/landing/industry-sports.webp", alt: "A yoga mat, dumbbells, running shoes, a water bottle, a training shirt and a gym bag", position: "50% 50%" },
  { name: "Toys & Lifestyle", text: "Toys, games and lifestyle products.", image: "/landing/industry-toys.webp", alt: "A teddy bear, wooden blocks, a toy robot, a red toy car, a game controller, headphones and a backpack", position: "38% 50%" },
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
              From electronics and fashion to healthcare and home essentials, Kanova Store helps businesses organize their products, orders, inventory and everyday store operations in one place.
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
