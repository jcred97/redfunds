import Image from "next/image";
import { useState } from "react";

const bankLogos = new Set([
  "bdo-unibank",
  "bpi",
  "metrobank",
  "landbank",
  "chinabank",
  "rcbc",
  "security-bank",
  "pnb",
  "unionbank",
  "eastwest-bank",
  "cimb-bank-philippines",
  "gotyme-bank",
  "maya-bank",
  "maribank-philippines",
  "overseas-filipino-bank",
  "tonik-digital-bank",
  "uniondigital-bank",
  "unobank",
]);

export default function BankLogo({ name }: { name: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const words = name.trim().split(/\s+/);
  const slug = words.join("-").toLowerCase();
  const logo = slug === "bdo" ? "bdo-unibank" : slug;
  const src = `/banks/${logo}.png`;
  const showLogo = bankLogos.has(logo) && failedSrc !== src;
  const initials = words.length === 1
    ? words[0].slice(0, 2)
    : words.slice(0, 2).map((word) => word[0]).join("");

  return (
    <span
      aria-hidden="true"
      className={`grid size-11 shrink-0 place-items-center overflow-hidden rounded-full ${
        showLogo ? "bg-white" : "bg-gray-700 text-xs font-semibold uppercase text-gray-100"
      }`}
    >
      {showLogo ? (
        <Image
          src={src}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="size-8 object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
