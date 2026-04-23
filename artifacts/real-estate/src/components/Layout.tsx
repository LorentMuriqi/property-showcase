import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, MapPin, Phone, Mail, Instagram, Facebook } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAdmin, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { name: "Kryefaqja", href: "/" },
    { name: "Prona", href: "/projects" },
    { name: "Rreth Nesh", href: "/about" },
    { name: "Kontakt", href: "/contact" },
  ];

  if (isAdmin) {
    navLinks.push({ name: "Paneli Administrativ", href: "/admin" });
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-background relative selection:bg-primary/20">
      <header
className="fixed top-0 left-0 right-0 z-50 bg-[#060913]/90 backdrop-blur-xl border-b border-white/5 py-4"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors">
              <img
                src={`${import.meta.env.BASE_URL}images/logo.svg`}
                alt="Logo"
                className="w-6 h-6 object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
<span className="font-display text-xl sm:text-2xl font-bold tracking-wider text-white group-hover:text-primary transition-colors">
  AURA
  <span className="font-sans font-light text-muted-foreground ml-2 text-sm tracking-widest uppercase">
    Estates
  </span>
</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
className={`text-sm font-medium tracking-wide uppercase transition-all hover:text-primary ${
  location === link.href ? "text-primary" : "text-gray-300"
}`}
              >
                {link.name}
              </Link>
            ))}

            {isAdmin && (
              <button
                onClick={logout}
                className="text-sm font-medium tracking-wide uppercase text-destructive hover:text-red-400 transition-colors"
              >
                Dalje
              </button>
            )}

            <Link
              href="/contact"
              className="px-6 py-2.5 rounded-none border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-medium text-sm tracking-widest uppercase"
            >
              Na Kontaktoni
            </Link>
          </nav>

          <button
            className="md:hidden text-white hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-3xl pt-24 pb-8 px-6 flex flex-col"
          >
            <nav className="flex flex-col gap-6 items-center justify-center flex-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
className={`price-font font-medium text-3xl transition-colors ${
  location === link.href ? "text-primary" : "text-white hover:text-primary"
}`}
                >
                  {link.name}
                </Link>
              ))}

              {isAdmin && (
                <button
                  onClick={logout}
                  className="price-font text-3xl text-destructive"
                >
                  Dalje
                </button>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow w-full flex flex-col">{children}</main>

      <footer className="bg-[#060913] border-t border-white/5 pt-20 pb-10 mt-auto w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
<span className="font-display text-2xl font-bold tracking-wider text-white mb-6 block">
  AURA
  <span className="font-sans font-light text-muted-foreground ml-2 text-sm tracking-widest uppercase">
    Estates
  </span>
</span>
              <p className="text-muted-foreground leading-relaxed max-w-md mb-8">
                Curating the world's most exceptional properties. We redefine luxury real estate through immersive virtual experiences and unparalleled service.
              </p>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                >
                  <Instagram size={18} />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                >
                  <Facebook size={18} />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-display text-lg text-white mb-6">Kontakt</h4>
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-primary mt-1 shrink-0" />
                  <span>Pejë<br />Fidanishte</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-primary shrink-0" />
                  <span>+383 49 123 456</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-primary shrink-0" />
                  <span>info@auraks.com</span>
                </li>
              </ul>
            </div>

            <div>
              <ul className="space-y-3 pt-[54px]">
                {navLinks
                  .filter((l) => !["Paneli Administrativ"].includes(l.name))
                  .map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-muted-foreground/60">
            <p>&copy; {new Date().getFullYear()} Aura Estates. Të gjitha të drejtat e rezervuara.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Politika e Privatësisë</a>
              <a href="#" className="hover:text-white transition-colors">Kushtet e Shërbimit</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}