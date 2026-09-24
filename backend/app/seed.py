"""
Idempotent seed script: workout exercise library, cafeteria menu, and one
default staff account for local/testing use.

Run with:  python -m app.seed
(safe to re-run — it only inserts rows that don't already exist)
"""
from app import models, security
from app.database import Base, SessionLocal, engine

DEFAULT_STAFF_USERNAME = "frontdesk"
DEFAULT_STAFF_PASSWORD = "Bhoomi@Front1"  # noqa: S105 — intentional dev-only default, see README

# NOTE on animation_url / image_url below: these point at a placeholder
# pattern (https://example.com/...) because we don't have confirmed-stable,
# freely-embeddable demo media to hardcode here. Shashank should swap these
# for real hosted GIFs/images (e.g. uploaded to S3/Cloudinary or committed
# into client-app/public) before shipping. Do not treat these URLs as live.

EXERCISES = [
    dict(
        slug="barbell-bench-press",
        name="Barbell Bench Press",
        muscle_group="chest",
        default_sets=4,
        default_reps=8,
        instructions=(
            "1. Lie flat on the bench with eyes roughly under the bar. Feet flat on the floor.\n"
            "2. Grip the bar slightly wider than shoulder width, wrists straight.\n"
            "3. Unrack the bar and hold it directly over your chest with arms locked.\n"
            "4. Lower the bar with control to mid-chest, elbows at roughly 45 degrees from your torso.\n"
            "5. Press the bar back up to the starting position without bouncing it off your chest.\n"
            "6. Keep your shoulder blades pinned back and glutes on the bench throughout.\n"
            "Always use a spotter or safety pins when going heavy."
        ),
    ),
    dict(
        slug="push-up",
        name="Push-Up",
        muscle_group="chest",
        default_sets=3,
        default_reps=15,
        instructions=(
            "1. Start in a plank position, hands slightly wider than shoulders, body in a straight line.\n"
            "2. Brace your core and squeeze your glutes so your hips don't sag.\n"
            "3. Lower your chest toward the floor by bending your elbows to about 45 degrees.\n"
            "4. Stop just above the floor, then press back up to full arm extension.\n"
            "5. Keep your neck neutral — look slightly ahead, not straight down.\n"
            "Regress on your knees if needed; keep the same straight-line torso."
        ),
    ),
    dict(
        slug="incline-dumbbell-press",
        name="Incline Dumbbell Press",
        muscle_group="chest",
        default_sets=3,
        default_reps=10,
        instructions=(
            "1. Set a bench to a 30-45 degree incline.\n"
            "2. Sit back with a dumbbell in each hand resting on your thighs, then kick them up to shoulder height as you lie back.\n"
            "3. Press the dumbbells up and slightly inward until your arms are extended over your upper chest.\n"
            "4. Lower with control until your upper arms are about parallel to the floor.\n"
            "5. Keep your lower back in contact with the bench; don't overarch.\n"
            "Press through a full range but stop if you feel shoulder pinching."
        ),
    ),
    dict(
        slug="lat-pulldown",
        name="Lat Pulldown",
        muscle_group="back",
        default_sets=4,
        default_reps=10,
        instructions=(
            "1. Sit at the pulldown machine and secure your thighs under the pad.\n"
            "2. Grip the bar wider than shoulder width, palms facing away from you.\n"
            "3. Lean back very slightly and pull the bar down to your upper chest, leading with your elbows.\n"
            "4. Squeeze your shoulder blades together at the bottom.\n"
            "5. Slowly let the bar rise back to full arm extension, controlling the weight the whole way.\n"
            "Avoid using body momentum to yank the bar down."
        ),
    ),
    dict(
        slug="seated-cable-row",
        name="Seated Cable Row",
        muscle_group="back",
        default_sets=4,
        default_reps=10,
        instructions=(
            "1. Sit at the cable row station with knees slightly bent, feet on the platform.\n"
            "2. Grab the handle with a neutral grip and sit tall, arms extended.\n"
            "3. Pull the handle toward your lower abdomen, driving your elbows straight back.\n"
            "4. Squeeze your shoulder blades together at the end of the pull.\n"
            "5. Extend your arms back out with control, keeping your spine upright (don't round or over-lean).\n"
            "Keep the movement smooth — no jerking with your lower back."
        ),
    ),
    dict(
        slug="pull-up",
        name="Pull-Up",
        muscle_group="back",
        default_sets=3,
        default_reps=6,
        instructions=(
            "1. Hang from a pull-up bar with hands just outside shoulder width, palms facing away.\n"
            "2. Start from a full dead hang, core braced, legs still.\n"
            "3. Pull your chest up toward the bar by driving your elbows down and back.\n"
            "4. Get your chin above the bar, then lower back to a full dead hang with control.\n"
            "5. Avoid kipping or swinging — use an assisted machine or resistance band if you can't yet do strict reps.\n"
        ),
    ),
    dict(
        slug="barbell-back-squat",
        name="Barbell Back Squat",
        muscle_group="legs",
        default_sets=4,
        default_reps=8,
        instructions=(
            "1. Set the bar on a rack at roughly upper-chest height. Position it across your upper back (not your neck).\n"
            "2. Unrack and step back, feet shoulder-width apart, toes slightly turned out.\n"
            "3. Brace your core, then bend your knees and hips together to squat down, chest up.\n"
            "4. Descend until your thighs are at least parallel to the floor, keeping knees tracking over your toes.\n"
            "5. Drive through your whole foot to stand back up to full hip and knee extension.\n"
            "Use a spotter or safety bars in the rack when adding weight."
        ),
    ),
    dict(
        slug="leg-press",
        name="Leg Press",
        muscle_group="legs",
        default_sets=4,
        default_reps=12,
        instructions=(
            "1. Sit in the leg press machine with feet shoulder-width on the platform, mid-foot centered.\n"
            "2. Release the safety catches and lower the platform by bending your knees toward your chest.\n"
            "3. Lower until your knees reach about 90 degrees — don't let your lower back round off the pad.\n"
            "4. Press through your heels and mid-foot to extend your legs back out, without locking your knees hard.\n"
            "5. Control the weight on the way down every rep — don't let it drop.\n"
        ),
    ),
    dict(
        slug="romanian-deadlift",
        name="Romanian Deadlift",
        muscle_group="legs",
        default_sets=3,
        default_reps=10,
        instructions=(
            "1. Stand holding a barbell or dumbbells at hip level, feet hip-width apart.\n"
            "2. Keep a slight bend in your knees that stays constant through the movement.\n"
            "3. Hinge at your hips, pushing them back, and lower the weight down the front of your legs.\n"
            "4. Keep your back flat and the weight close to your legs; stop when you feel a stretch in your hamstrings (roughly shin height).\n"
            "5. Drive your hips forward to return to standing, squeezing your glutes at the top.\n"
            "This is a hip-hinge, not a squat — your knees barely move."
        ),
    ),
    dict(
        slug="walking-lunge",
        name="Walking Lunge",
        muscle_group="legs",
        default_sets=3,
        default_reps=12,
        instructions=(
            "1. Stand tall holding dumbbells at your sides (or bodyweight to start).\n"
            "2. Step forward with one leg and lower your hips until both knees are bent about 90 degrees.\n"
            "3. Keep your front knee over your ankle, not past your toes, and your torso upright.\n"
            "4. Push off through your front heel to bring your back leg forward into the next step.\n"
            "5. Continue alternating legs for the set, keeping your core braced throughout.\n"
        ),
    ),
    dict(
        slug="overhead-barbell-press",
        name="Overhead Barbell Press",
        muscle_group="shoulders",
        default_sets=4,
        default_reps=8,
        instructions=(
            "1. Stand with feet shoulder-width apart, bar racked at your upper chest, hands just outside shoulder width.\n"
            "2. Brace your core and squeeze your glutes so you don't lean back excessively.\n"
            "3. Press the bar straight up, moving your head back slightly to let it pass, then forward once it clears.\n"
            "4. Lock out fully overhead with the bar over your mid-foot.\n"
            "5. Lower with control back to the starting rack position at your upper chest.\n"
        ),
    ),
    dict(
        slug="dumbbell-lateral-raise",
        name="Dumbbell Lateral Raise",
        muscle_group="shoulders",
        default_sets=3,
        default_reps=15,
        instructions=(
            "1. Stand holding a light-to-moderate dumbbell in each hand at your sides, slight bend in the elbows.\n"
            "2. Raise both arms out to the sides until they reach roughly shoulder height, leading with your elbows.\n"
            "3. Keep a slight forward tilt of the hands (like pouring a jug) rather than shrugging your shoulders up.\n"
            "4. Pause briefly at the top, then lower with control back to your sides.\n"
            "Use lighter weight than you think — strict form matters more than load here."
        ),
    ),
    dict(
        slug="barbell-bicep-curl",
        name="Barbell Bicep Curl",
        muscle_group="arms",
        default_sets=3,
        default_reps=10,
        instructions=(
            "1. Stand tall holding a barbell with an underhand grip, shoulder-width apart, arms extended.\n"
            "2. Keep your elbows pinned to your sides throughout the movement.\n"
            "3. Curl the bar up toward your shoulders by bending your elbows, without swinging your back.\n"
            "4. Squeeze your biceps at the top, then lower the bar with control to full extension.\n"
            "5. Avoid using momentum from your hips or lower back to lift the weight.\n"
        ),
    ),
    dict(
        slug="triceps-rope-pushdown",
        name="Triceps Rope Pushdown",
        muscle_group="arms",
        default_sets=3,
        default_reps=12,
        instructions=(
            "1. Attach a rope handle to a high cable pulley and grip one end in each hand, palms facing in.\n"
            "2. Keep your elbows tucked at your sides and pinned in place — they shouldn't drift forward.\n"
            "3. Extend your forearms down and slightly apart, straightening your elbows fully.\n"
            "4. Squeeze your triceps at the bottom, then let the rope rise back with control to about 90 degrees at the elbow.\n"
            "5. Keep your torso upright — don't lean into the movement to push more weight.\n"
        ),
    ),
    dict(
        slug="plank",
        name="Plank",
        muscle_group="core",
        default_sets=3,
        default_reps=1,
        instructions=(
            "1. Lie face down, then prop yourself up on your forearms and toes.\n"
            "2. Elbows directly under your shoulders, body in one straight line from head to heels.\n"
            "3. Brace your core and squeeze your glutes so your hips don't sag or pike up.\n"
            "4. Keep breathing steadily and hold the position for time (e.g. 30-60 seconds per set).\n"
            "5. Stop and reset if your lower back starts to sag — quality over duration.\n"
        ),
    ),
    dict(
        slug="hanging-leg-raise",
        name="Hanging Leg Raise",
        muscle_group="core",
        default_sets=3,
        default_reps=12,
        instructions=(
            "1. Hang from a pull-up bar with arms fully extended, shoulders engaged (not fully relaxed).\n"
            "2. Keeping your legs straight (or knees bent as a regression), raise them up in front of you.\n"
            "3. Lift until your legs are at least parallel to the floor, using your lower abs — avoid swinging.\n"
            "4. Pause briefly at the top, then lower your legs back down with control.\n"
            "5. Keep your core braced throughout to minimize body swing.\n"
        ),
    ),
    dict(
        slug="russian-twist",
        name="Russian Twist",
        muscle_group="core",
        default_sets=3,
        default_reps=20,
        instructions=(
            "1. Sit on the floor with knees bent, heels on the ground (or lifted slightly for more difficulty).\n"
            "2. Lean back to about a 45 degree angle, keeping your back flat, holding a weight or medicine ball at your chest.\n"
            "3. Rotate your torso to tap the weight on the floor beside your hip.\n"
            "4. Rotate through to the other side and tap the floor there too — that's one rep.\n"
            "5. Move with control from your core, not by flinging your arms.\n"
        ),
    ),
    dict(
        slug="treadmill-running",
        name="Treadmill Running (Steady State)",
        muscle_group="cardio",
        default_sets=1,
        default_reps=1,
        instructions=(
            "1. Start with a 3-5 minute brisk walk to warm up.\n"
            "2. Increase the speed gradually to a comfortable running pace where you can still speak in short sentences.\n"
            "3. Maintain an upright posture, relaxed shoulders, and a natural arm swing.\n"
            "4. Hold the pace for your target duration (e.g. 20-30 minutes).\n"
            "5. Cool down with 3-5 minutes of walking at the end to bring your heart rate down gradually.\n"
        ),
    ),
    dict(
        slug="jump-rope",
        name="Jump Rope",
        muscle_group="cardio",
        default_sets=5,
        default_reps=60,
        instructions=(
            "1. Hold the rope handles at hip height, elbows close to your body.\n"
            "2. Turn the rope mainly with your wrists, not your whole arms.\n"
            "3. Jump just high enough to clear the rope — small, quick hops on the balls of your feet.\n"
            "4. Keep a soft bend in your knees to absorb impact.\n"
            "5. Work in short intervals (e.g. 30-60 seconds on, 30 seconds rest) rather than one long unbroken set when starting out.\n"
        ),
    ),
    dict(
        slug="rowing-machine-intervals",
        name="Rowing Machine Intervals",
        muscle_group="cardio",
        default_sets=6,
        default_reps=1,
        instructions=(
            "1. Strap your feet in, grip the handle with both hands, knees bent, arms extended.\n"
            "2. Drive with your legs first, then lean your torso back slightly, then pull the handle to your lower ribs.\n"
            "3. Reverse the order on the way back: arms out, torso forward, then bend your knees to slide forward.\n"
            "4. Row at a hard effort for the work interval (e.g. 30-45 seconds).\n"
            "5. Row light and easy during the rest interval, then repeat for the set count.\n"
            "Legs-hips-arms on the drive, arms-hips-legs on the recovery — in that order."
        ),
    ),
]

CAFETERIA_MENU = [
    dict(name="Classic Whey Protein Shake", description="Whey protein isolate blended with milk, banana and ice.",
         price_inr=180, category="Shakes", available=True),
    dict(name="Peanut Butter Banana Shake", description="Whey protein, peanut butter, banana and milk.",
         price_inr=220, category="Shakes", available=True),
    dict(name="Egg White Bowl", description="6 egg whites sautéed with onion, tomato and bell pepper.",
         price_inr=150, category="Bowls", available=True),
    dict(name="Grilled Chicken Breast Bowl", description="150g grilled chicken breast, brown rice and sautéed veggies.",
         price_inr=260, category="Bowls", available=True),
    dict(name="Paneer Tikka Bowl", description="Grilled paneer tikka, quinoa and a side salad.",
         price_inr=240, category="Bowls", available=True),
    dict(name="Sprouts & Chana Salad", description="Mixed sprouts, boiled chana, onion, tomato, lemon and chaat masala.",
         price_inr=120, category="Salads", available=True),
    dict(name="Greek Yogurt & Berry Bowl", description="Greek yogurt, mixed berries, honey and granola.",
         price_inr=150, category="Bowls", available=True),
    dict(name="Oats & Almond Porridge", description="Rolled oats cooked with milk, almonds and a touch of jaggery.",
         price_inr=110, category="Bowls", available=True),
    dict(name="Mixed Fruit Smoothie", description="Seasonal fruit blended with yogurt and honey.",
         price_inr=160, category="Smoothies", available=True),
    dict(name="Green Detox Smoothie", description="Spinach, apple, cucumber, ginger and lemon.",
         price_inr=170, category="Smoothies", available=True),
    dict(name="Black Coffee (Filter)", description="South Indian filter coffee, no milk or sugar.",
         price_inr=40, category="Beverages", available=True),
    dict(name="Black Coffee (Americano)", description="Espresso-based black coffee, no milk or sugar.",
         price_inr=60, category="Beverages", available=True),
    dict(name="Spiced Buttermilk (Chaas)", description="Chilled spiced buttermilk with curry leaf and cumin.",
         price_inr=40, category="Beverages", available=True),
    dict(name="Coconut Water", description="Fresh tender coconut water, chilled.",
         price_inr=50, category="Beverages", available=True),
    dict(name="Roasted Chana (Masala)", description="Roasted chickpeas tossed in a light masala seasoning.",
         price_inr=60, category="Snacks", available=True),
    dict(name="Peanut Chikki Protein Bar", description="Homestyle peanut-jaggery bar, a natural pre-workout snack.",
         price_inr=80, category="Snacks", available=True),
    dict(name="Boiled Eggs (2 pcs)", description="Two whole boiled eggs with a pinch of pepper and salt.",
         price_inr=40, category="Snacks", available=True),
    dict(name="Multigrain Veg Sandwich", description="Multigrain bread, cucumber, tomato, lettuce and mint chutney.",
         price_inr=90, category="Snacks", available=True),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # --- Exercises -------------------------------------------------
        existing_slugs = {e.slug for e in db.query(models.WorkoutExercise.slug).all()}
        added_exercises = 0
        for ex in EXERCISES:
            if ex["slug"] in existing_slugs:
                continue
            db.add(
                models.WorkoutExercise(
                    slug=ex["slug"],
                    name=ex["name"],
                    muscle_group=ex["muscle_group"],
                    instructions=ex["instructions"],
                    animation_url=f"https://example.com/exercises/{ex['slug']}.gif",
                    default_sets=ex["default_sets"],
                    default_reps=ex["default_reps"],
                )
            )
            added_exercises += 1
        db.commit()

        # --- Cafeteria menu ----------------------------------------------
        existing_names = {n for (n,) in db.query(models.CafeteriaMenuItem.name).all()}
        added_menu = 0
        for item in CAFETERIA_MENU:
            if item["name"] in existing_names:
                continue
            slug = item["name"].lower().replace(" ", "-").replace("(", "").replace(")", "").replace("&", "and")
            db.add(
                models.CafeteriaMenuItem(
                    name=item["name"],
                    description=item["description"],
                    price_inr=item["price_inr"],
                    category=item["category"],
                    image_url=f"https://example.com/cafeteria/{slug}.jpg",
                    available=item["available"],
                )
            )
            added_menu += 1
        db.commit()

        # --- Default staff account --------------------------------------
        staff_created = False
        existing_staff = db.query(models.StaffUser).filter(models.StaffUser.username == DEFAULT_STAFF_USERNAME).first()
        if existing_staff is None:
            db.add(
                models.StaffUser(
                    username=DEFAULT_STAFF_USERNAME,
                    password_hash=security.hash_password(DEFAULT_STAFF_PASSWORD),
                    full_name="Front Desk",
                    role="staff",
                    active=True,
                )
            )
            db.commit()
            staff_created = True

        print("=" * 60)
        print("Bhoomi Fitness — seed complete")
        print(f"  Workout exercises added: {added_exercises} (skipped {len(EXERCISES) - added_exercises} already present)")
        print(f"  Cafeteria menu items added: {added_menu} (skipped {len(CAFETERIA_MENU) - added_menu} already present)")
        if staff_created:
            print("  Default staff account created:")
            print(f"    username: {DEFAULT_STAFF_USERNAME}")
            print(f"    password: {DEFAULT_STAFF_PASSWORD}")
            print("    >>> CHANGE THIS PASSWORD before going live. <<<")
        else:
            print(f"  Default staff account '{DEFAULT_STAFF_USERNAME}' already exists — left untouched.")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
