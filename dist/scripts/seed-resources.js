import "dotenv/config";
import { prisma } from "../lib/prisma.js";
const seed = [
    {
        titleEn: "A small guide to slowing down",
        titleEs: "Una pequeña guía para ir más despacio",
        bodyEn: "Slowing down is not laziness. It is a quiet act of care. Start with one breath, one pause, one moment without rushing.",
        bodyEs: "Ir más despacio no es pereza. Es un acto silencioso de cuidado. Empieza con una respiración, una pausa, un momento sin prisa.",
        minutes: 5,
        bgColor: "var(--note-3)",
        sortOrder: 0,
        published: true,
    },
    {
        titleEn: "When anxiety knocks softly",
        titleEs: "Cuando la ansiedad llama suavemente",
        bodyEn: "Anxiety often arrives as a soft knock. Notice it, name it, and give it space instead of fighting it. You are safe here.",
        bodyEs: "La ansiedad a menudo llega como un golpecito suave. Nómbrala, dale espacio en lugar de pelear con ella. Aquí estás a salvo.",
        minutes: 7,
        bgColor: "var(--note-2)",
        sortOrder: 1,
        published: true,
    },
    {
        titleEn: "The art of choosing rest",
        titleEs: "El arte de elegir el descanso",
        bodyEn: "Rest is not something you earn. It is something your nervous system needs. Choosing rest is choosing yourself.",
        bodyEs: "El descanso no es algo que debas ganar. Es algo que tu sistema nervioso necesita. Elegir descansar es elegirte a ti.",
        minutes: 4,
        bgColor: "var(--note-4)",
        sortOrder: 2,
        published: true,
    },
    {
        titleEn: "Sleep, breath and morning light",
        titleEs: "Sueño, respiración y luz de la mañana",
        bodyEn: "Morning light, a few slow breaths, and a soft intention. Small rituals can gently reshape how the day begins.",
        bodyEs: "Luz de la mañana, unas respiraciones lentas y una intención suave. Los pequeños rituales pueden transformar cómo empieza el día.",
        minutes: 6,
        bgColor: "var(--note-1)",
        sortOrder: 3,
        published: true,
    },
];
async function main() {
    // Remove existing so we always get a clean set of the 4 originals
    await prisma.resource.deleteMany({});
    await prisma.resource.createMany({ data: seed });
    console.log("Seeded 4 resources.");
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
