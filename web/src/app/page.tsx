import Image from "next/image";
import Link from "next/link";
import { WORKING_HOURS } from "@/lib/constants";

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/interior/lounge-1.jpg"
            alt="Смарагдова кімната Tyaga Pyriatyn"
            fill
            priority
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-24 sm:py-32 text-center">
          <p className="text-brass tracking-[0.3em] text-xs sm:text-sm uppercase mb-4">
            Кальян-лаунж · Пирятин
          </p>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
            Tyaga <span className="text-emerald-light">Pyriatyn</span>
          </h1>
          <p className="mt-6 text-muted max-w-xl mx-auto">
            Затишна смарагдова кімната та тераса з вогнищем. Забронюйте столик, оберіть смак
            з нашого каталогу або заберіть свіжу забивку з собою.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/booking"
              className="rounded-full bg-emerald hover:bg-emerald-light transition-colors px-6 py-3 font-semibold"
            >
              Забронювати столик
            </Link>
            <Link
              href="/menu"
              className="rounded-full border border-brass/50 hover:bg-brass/10 transition-colors px-6 py-3 font-semibold"
            >
              Каталог смаків
            </Link>
            <Link
              href="/order"
              className="rounded-full border border-brass/50 hover:bg-brass/10 transition-colors px-6 py-3 font-semibold"
            >
              Забивка на виніс
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Столики",
            text: "Оберіть місце на візуальній схемі — смарагдова кімната або тераса з вогнищем.",
            href: "/booking",
            img: "/interior/terrace-1.jpg",
          },
          {
            title: "92 смаки табака",
            text: "Фільтруйте за брендом та міцністю: легкі, середні, міцні.",
            href: "/menu",
            img: "/interior/tobacco-counter.jpg",
          },
          {
            title: "Забивка на самовивіз",
            text: "Зберіть свій мікс до 4 смаків, оберіть вугілля та час, коли забрати.",
            href: "/order",
            img: "/interior/bar-corner.jpg",
          },
          {
            title: "Кальян додому",
            text: "Привеземо повний сетап туди, де зручно вам — додому, на пікнік чи подію.",
            href: "/delivery",
            img: "/delivery/delivery-1.jpg",
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl overflow-hidden border border-brass/20 bg-panel hover:border-brass/50 transition-colors"
          >
            <div className="relative h-40">
              <Image
                src={card.img}
                alt={card.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg mb-1">{card.title}</h3>
              <p className="text-sm text-muted">{card.text}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">Атмосфера Tyaga</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              img: "/interior/neon-hookahs.jpg",
              title: "Неонові вечори",
              text: "Кожна забивка тліє у своєму кольорі — світло тут таке ж частина настрою, як і дим.",
            },
            {
              img: "/interior/lounge-vibe.jpg",
              title: "Тут можна залипнути надовго",
              text: "Кальян, екран і хороша компанія — і час якось непомітно зникає.",
            },
          ].map((item) => (
            <div
              key={item.img}
              className="group relative rounded-2xl overflow-hidden border border-brass/20 h-72 sm:h-96"
            >
              <Image
                src={item.img}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="font-bold text-lg">{item.title}</h3>
                <p className="text-sm text-muted mt-1">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-bold mb-2 text-center">Галерея</h2>
        <p className="text-muted text-center mb-8 max-w-xl mx-auto">
          Як це виглядає зсередини: світло, колби і полиці з табаком.
        </p>
        {/* Сітка нерівна навмисне — перше фото на дві колонки, решта поспіль,
            щоб не було відчуття каталогу. Всі знімки віддає next/image, тож
            мобільний отримає меншу версію, а не повний файл. */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { src: "/gallery/gallery-1.jpg", alt: "Ряд кальянів у фіолетовому підсвіченні", wide: true },
            { src: "/gallery/gallery-2.jpg", alt: "Кальяни в червоному неоні", wide: true },
            { src: "/gallery/gallery-3.jpg", alt: "Зелене світло на колбах" },
            { src: "/gallery/gallery-4.jpg", alt: "Синій неон над барною стійкою" },
            { src: "/gallery/gallery-5.jpg", alt: "Тепле бурштинове світло" },
            { src: "/gallery/gallery-6.jpg", alt: "Дві колби у зеленому світлі" },
            { src: "/gallery/gallery-7.jpg", alt: "Кальяни з кольоровими шлангами" },
            { src: "/gallery/gallery-8.jpg", alt: "Кальян на тлі дерев'яної стіни" },
            { src: "/gallery/gallery-9.jpg", alt: "Колба крупним планом" },
            { src: "/gallery/gallery-10.jpg", alt: "Банки табаку одна на одній" },
            { src: "/gallery/gallery-11.jpg", alt: "Забивка чаші та пачки табаку Lagom" },
            { src: "/gallery/gallery-12.jpg", alt: "Полиця з банками табаку" },
          ].map((photo) => (
            <div
              key={photo.src}
              className={`group relative overflow-hidden rounded-xl border border-brass/20 ${
                photo.wide ? "col-span-2 aspect-[4/3]" : "aspect-[3/4]"
              }`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="rounded-2xl border border-brass/20 bg-panel p-8 text-center">
          <p className="text-muted">{WORKING_HOURS}</p>
          <p className="text-sm text-muted mt-1">м. Пирятин</p>
        </div>
      </section>
    </div>
  );
}
