/**
 * The Legacy Vault question library.
 *
 * Original questions, written for this app, organized as themed decks.
 * Design principles (informed by what works in guided-memoir products):
 *  - Ask for ONE story or ONE explanation, never "tell me about your life"
 *  - Concrete beats abstract: "the smell of your childhood kitchen" beats
 *    "describe your childhood"
 *  - The practical decks (house, money, just-in-case) are what make this a
 *    vault and not just a memoir
 *  - suggested_type nudges the natural medium: stories → video, quick
 *    knowledge → audio, letters for milestones → text
 */

const V = 'video';
const A = 'audio';
const T = 'text';

module.exports = [
  /* ---------------- How it all began ---------------- */
  { theme: 'How It All Began', type: V, text: 'Tell the story of the first time you saw Mom. Where were you, and what did you notice first?' },
  { theme: 'How It All Began', type: V, text: 'What was your first date — and what almost went wrong?' },
  { theme: 'How It All Began', type: V, text: 'When did you know she was the one? Was there a single moment?' },
  { theme: 'How It All Began', type: V, text: 'Tell the proposal story — the real version, including the parts that didn\u2019t go to plan.' },
  { theme: 'How It All Began', type: V, text: 'What do you remember most from your wedding day that isn\u2019t in any photo?' },
  { theme: 'How It All Began', type: V, text: 'What\u2019s a hard season you two got through together, and what got you through it?' },
  { theme: 'How It All Began', type: A, text: 'What\u2019s a small habit of hers you\u2019ve secretly loved all these years?' },
  { theme: 'How It All Began', type: V, text: 'What did you learn about marriage that nobody told you beforehand?' },
  { theme: 'How It All Began', type: V, text: 'Describe your first apartment or house together. What was terrible about it, and what was perfect?' },
  { theme: 'How It All Began', type: A, text: 'What song takes you straight back to when you were dating, and why?' },
  { theme: 'How It All Began', type: T, text: 'Write the story of the day each of your kids was born, one letter per kid.' },
  { theme: 'How It All Began', type: V, text: 'What\u2019s your best advice for keeping a marriage strong when life gets busy or hard?' },

  /* ---------------- When you were small ---------------- */
  { theme: 'When You Were Small', type: V, text: 'Describe the house you grew up in, room by room, the way you remember it.' },
  { theme: 'When You Were Small', type: V, text: 'What did a normal Saturday look like when you were ten?' },
  { theme: 'When You Were Small', type: V, text: 'What\u2019s the naughtiest thing you did as a kid — and did you get caught?' },
  { theme: 'When You Were Small', type: A, text: 'What smells or sounds take you instantly back to childhood?' },
  { theme: 'When You Were Small', type: V, text: 'Who was your childhood best friend, and what adventure defined that friendship?' },
  { theme: 'When You Were Small', type: V, text: 'What were you afraid of as a kid, and how did you get over it — or didn\u2019t you?' },
  { theme: 'When You Were Small', type: V, text: 'What was your first job, what did it pay, and what did it teach you?' },
  { theme: 'When You Were Small', type: A, text: 'What meal from your childhood do you still crave, and who made it best?' },
  { theme: 'When You Were Small', type: V, text: 'Tell the story of the best summer you ever had.' },
  { theme: 'When You Were Small', type: V, text: 'What was school like for you — what were you good at, and what did you hate?' },
  { theme: 'When You Were Small', type: V, text: 'What did you want to be when you grew up, and what happened to that dream?' },
  { theme: 'When You Were Small', type: A, text: 'What\u2019s a toy or possession you loved beyond reason as a kid?' },
  { theme: 'When You Were Small', type: V, text: 'How was the world different when you were young in a way the kids would find hard to believe?' },

  /* ---------------- The people before us ---------------- */
  { theme: 'The People Before Us', type: V, text: 'Tell me about your mother — her voice, her hands, what she\u2019d say when you walked in the door.' },
  { theme: 'The People Before Us', type: V, text: 'Tell me about your father — what he did all day, and what he was like at the dinner table.' },
  { theme: 'The People Before Us', type: V, text: 'What\u2019s one story about your grandparents that must not be lost?' },
  { theme: 'The People Before Us', type: V, text: 'Where does our family come from, as far back as you know? Who moved, and why?' },
  { theme: 'The People Before Us', type: V, text: 'What did your parents sacrifice that you only understood later?' },
  { theme: 'The People Before Us', type: A, text: 'What phrase or saying did your mother or father repeat that still rings in your head?' },
  { theme: 'The People Before Us', type: V, text: 'Which relative were you closest to growing up, and what did they teach you?' },
  { theme: 'The People Before Us', type: V, text: 'Is there a family legend — the story everyone tells at gatherings? Tell your version.' },
  { theme: 'The People Before Us', type: V, text: 'What family trait — good or bad — got passed down to you, and have you passed it on?' },
  { theme: 'The People Before Us', type: T, text: 'Write down who\u2019s who in the old family photos, before the names are lost.' },
  { theme: 'The People Before Us', type: V, text: 'Tell me about a relative the kids never met but should feel like they know.' },
  { theme: 'The People Before Us', type: V, text: 'What hardship did your parents or grandparents live through, and how did it shape our family?' },

  /* ---------------- Traditions & recipes ---------------- */
  { theme: 'Traditions & Recipes', type: V, text: 'Cook the family dish on camera — every step, including the parts that aren\u2019t written down anywhere.' },
  { theme: 'Traditions & Recipes', type: V, text: 'How did your family do Christmas (or your biggest holiday) when you were a kid, start to finish?' },
  { theme: 'Traditions & Recipes', type: V, text: 'What tradition did you start with your own family, and what\u2019s the story behind it?' },
  { theme: 'Traditions & Recipes', type: A, text: 'What dish should be served at every family gathering forever, and who taught it to you?' },
  { theme: 'Traditions & Recipes', type: T, text: 'Write down the three family recipes that must survive, with your notes in the margins.' },
  { theme: 'Traditions & Recipes', type: V, text: 'What\u2019s a birthday tradition in our family, and how did it start?' },
  { theme: 'Traditions & Recipes', type: V, text: 'What do we always do on vacation that no other family seems to do?' },
  { theme: 'Traditions & Recipes', type: A, text: 'What\u2019s a tradition you hope the kids keep going with their own children someday?' },
  { theme: 'Traditions & Recipes', type: V, text: 'Show how to set up or do something ceremonial in our house — the tree, the grill ritual, the game-day spread.' },
  { theme: 'Traditions & Recipes', type: V, text: 'What\u2019s the story behind an heirloom or object in our house the kids see every day?' },

  /* ---------------- Adventures & travels ---------------- */
  { theme: 'Adventures & Travels', type: V, text: 'Tell the story of the best trip you ever took, and the moment from it you\u2019d relive.' },
  { theme: 'Adventures & Travels', type: V, text: 'What\u2019s the most trouble you\u2019ve ever been in away from home?' },
  { theme: 'Adventures & Travels', type: V, text: 'Describe a place you saw once and never forgot.' },
  { theme: 'Adventures & Travels', type: A, text: 'What\u2019s the best meal you\u2019ve eaten anywhere in the world?' },
  { theme: 'Adventures & Travels', type: V, text: 'Tell the story of a trip where everything went wrong — the one that\u2019s funny now.' },
  { theme: 'Adventures & Travels', type: V, text: 'Where would you still love the family to go someday, and what should they do there?' },
  { theme: 'Adventures & Travels', type: V, text: 'What\u2019s the bravest or most out-of-character thing you\u2019ve ever done?' },
  { theme: 'Adventures & Travels', type: A, text: 'Beach, mountains, or city — and defend your answer.' },
  { theme: 'Adventures & Travels', type: V, text: 'Tell the story of a stranger you met once who you still think about.' },
  { theme: 'Adventures & Travels', type: V, text: 'What road trip should the kids take at least once, and what\u2019s the route?' },

  /* ---------------- Work & craft ---------------- */
  { theme: 'Work & Craft', type: V, text: 'What do you actually do all day at work? Explain it like the kids are twelve.' },
  { theme: 'Work & Craft', type: V, text: 'Tell the story of how you got into your line of work — the plan and the accidents.' },
  { theme: 'Work & Craft', type: V, text: 'What\u2019s the proudest moment of your working life?' },
  { theme: 'Work & Craft', type: V, text: 'Tell me about a failure at work that taught you more than any success.' },
  { theme: 'Work & Craft', type: A, text: 'What\u2019s the best career advice you ever received, and who gave it to you?' },
  { theme: 'Work & Craft', type: V, text: 'Who was the best boss or mentor you ever had, and what made them great?' },
  { theme: 'Work & Craft', type: V, text: 'What skill are you genuinely great at, and how did you build it?' },
  { theme: 'Work & Craft', type: V, text: 'If the kids ever want to do what you do, what\u2019s your honest advice?' },
  { theme: 'Work & Craft', type: A, text: 'What does a good work ethic actually look like, day to day?' },
  { theme: 'Work & Craft', type: V, text: 'Teach one professional skill on camera — negotiating, writing an email that gets answered, fixing the thing you fix.' },

  /* ---------------- Hard times & what they taught ---------------- */
  { theme: 'Hard Times', type: V, text: 'What\u2019s the hardest thing you\u2019ve ever been through, and what got you to the other side?' },
  { theme: 'Hard Times', type: V, text: 'Tell me about a time you failed badly — and what you\u2019d tell the kids when they fail.' },
  { theme: 'Hard Times', type: V, text: 'What\u2019s a decision you regret, and what did it cost you?' },
  { theme: 'Hard Times', type: V, text: 'When were you most scared as an adult, and what did you do?' },
  { theme: 'Hard Times', type: A, text: 'What do you do on the days when everything feels like too much?' },
  { theme: 'Hard Times', type: V, text: 'Tell me about losing someone you loved, and what helped even a little.' },
  { theme: 'Hard Times', type: V, text: 'What\u2019s something you struggled with for years that got better? How?' },
  { theme: 'Hard Times', type: T, text: 'Write a letter for a day when one of the kids is heartbroken.' },
  { theme: 'Hard Times', type: T, text: 'Write a letter for a day when one of the kids feels like they\u2019ve let everyone down.' },
  { theme: 'Hard Times', type: V, text: 'What worry took up years of your life that turned out not to matter?' },

  /* ---------------- What I believe ---------------- */
  { theme: 'What I Believe', type: V, text: 'What do you believe about God, the universe, or what happens after — and how did you get there?' },
  { theme: 'What I Believe', type: V, text: 'What are the three rules you\u2019ve actually tried to live by?' },
  { theme: 'What I Believe', type: V, text: 'What does being a good man or good woman mean to you, in practice?' },
  { theme: 'What I Believe', type: A, text: 'What\u2019s a belief you held strongly at 25 that you\u2019ve completely changed your mind about?' },
  { theme: 'What I Believe', type: V, text: 'What matters more than money — and when did you learn it?' },
  { theme: 'What I Believe', type: V, text: 'How do you decide what\u2019s right when the answer isn\u2019t obvious?' },
  { theme: 'What I Believe', type: V, text: 'What do you hope people say about you when you\u2019re not in the room?' },
  { theme: 'What I Believe', type: A, text: 'What\u2019s worth fighting for, and what\u2019s worth letting go?' },
  { theme: 'What I Believe', type: T, text: 'Write down the family values — the short list you\u2019d want carved somewhere.' },
  { theme: 'What I Believe', type: V, text: 'What makes a life well lived? Answer like it\u2019s the last question you\u2019ll ever get.' },

  /* ---------------- Favorites & small joys ---------------- */
  { theme: 'Favorites & Small Joys', type: A, text: 'What\u2019s your favorite song of all time, and where does it take you?' },
  { theme: 'Favorites & Small Joys', type: V, text: 'What movie can you quote start to finish, and why that one?' },
  { theme: 'Favorites & Small Joys', type: A, text: 'Describe your perfect ordinary day — no travel, no money, just a great normal day.' },
  { theme: 'Favorites & Small Joys', type: V, text: 'What\u2019s the funniest thing that\u2019s ever happened to this family?' },
  { theme: 'Favorites & Small Joys', type: A, text: 'What food will you never, ever eat, and what\u2019s the story there?' },
  { theme: 'Favorites & Small Joys', type: V, text: 'Do your impressions. All of them. Yes, on camera.' },
  { theme: 'Favorites & Small Joys', type: A, text: 'What book changed how you see things, and what should the kids read someday?' },
  { theme: 'Favorites & Small Joys', type: V, text: 'What\u2019s your most controversial harmless opinion? Make the case.' },
  { theme: 'Favorites & Small Joys', type: A, text: 'Coffee order, sandwich order, and your exact breakfast — for the record.' },
  { theme: 'Favorites & Small Joys', type: V, text: 'Tell your best joke and your worst joke. Commit to both.' },
  { theme: 'Favorites & Small Joys', type: V, text: 'What hobby has given you the most joy, and how would someone get started?' },

  /* ---------------- For your milestones ---------------- */
  { theme: 'For Your Milestones', type: T, text: 'Write a letter for each kid to open on their 18th birthday.' },
  { theme: 'For Your Milestones', type: T, text: 'Write a letter for their wedding day.' },
  { theme: 'For Your Milestones', type: T, text: 'Write a letter for the day they become a parent.' },
  { theme: 'For Your Milestones', type: V, text: 'Record advice for their first real job — first week, first paycheck, first bad boss.' },
  { theme: 'For Your Milestones', type: V, text: 'Record a message for the day they get their driver\u2019s license.' },
  { theme: 'For Your Milestones', type: T, text: 'Write a letter for the day they leave home.' },
  { theme: 'For Your Milestones', type: V, text: 'Record advice for choosing a partner — what to look for, what to run from.' },
  { theme: 'For Your Milestones', type: T, text: 'Write a letter for a graduation you might not be at.' },
  { theme: 'For Your Milestones', type: V, text: 'Record a message for their first big heartbreak.' },
  { theme: 'For Your Milestones', type: V, text: 'Record a message for the day they buy their first home.' },
  { theme: 'For Your Milestones', type: T, text: 'Write a letter to your future grandchildren, whoever they turn out to be.' },
  { theme: 'For Your Milestones', type: V, text: 'Record a toast for a celebration you might miss — write it like you\u2019re in the room.' },

  /* ---------------- The house & how things work ---------------- */
  { theme: 'The House & How Things Work', type: V, text: 'Walk the house on camera: where\u2019s the water shutoff, the breaker panel, the gas valve — and when to use each.' },
  { theme: 'The House & How Things Work', type: V, text: 'Show how the furnace and water heater work, what the scary noises mean, and who to call.' },
  { theme: 'The House & How Things Work', type: V, text: 'What are the house\u2019s quirks? The door that sticks, the switch that does nothing, the trick to the garage.' },
  { theme: 'The House & How Things Work', type: V, text: 'Show the seasonal routine: what gets done every spring and every fall so the house doesn\u2019t fall apart.' },
  { theme: 'The House & How Things Work', type: A, text: 'Which repairs are DIY and which are always call-a-pro? Name your trusted people.' },
  { theme: 'The House & How Things Work', type: V, text: 'Show how to maintain the car(s): oil, tires, what that dashboard light actually means.' },
  { theme: 'The House & How Things Work', type: V, text: 'Show the sprinklers, the pool, or whatever system only you understand.' },
  { theme: 'The House & How Things Work', type: T, text: 'Write the "house manual": alarm codes location, wifi setup, warranties, paint colors, filter sizes.' },
  { theme: 'The House & How Things Work', type: V, text: 'Show where everything important is physically kept — keys, spares, tools, documents box.' },
  { theme: 'The House & How Things Work', type: V, text: 'Teach the lawn. Or the garden. Whatever you\u2019ve spent twenty years perfecting out there.' },

  /* ---------------- Money & important papers ---------------- */
  { theme: 'Money & Important Papers', type: T, text: 'List every account that exists: banks, retirement, investments, insurance — institution names and account types (never passwords here).' },
  { theme: 'Money & Important Papers', type: V, text: 'Explain the family finances in plain words: what comes in, what goes out, what\u2019s owed, what\u2019s saved.' },
  { theme: 'Money & Important Papers', type: V, text: 'Where are the will, the deeds, the titles, and the insurance policies — physically and digitally?' },
  { theme: 'Money & Important Papers', type: A, text: 'Who are our people: the accountant, the lawyer, the insurance agent, the financial advisor — names and how to reach them.' },
  { theme: 'Money & Important Papers', type: V, text: 'Explain your approach to money — the philosophy behind how you saved, spent, and invested.' },
  { theme: 'Money & Important Papers', type: V, text: 'What insurance exists and what is each policy actually for?' },
  { theme: 'Money & Important Papers', type: T, text: 'Write down the recurring bills and subscriptions — what they are, roughly what they cost, how they\u2019re paid.' },
  { theme: 'Money & Important Papers', type: V, text: 'What financial mistakes did you make that the kids should skip?' },
  { theme: 'Money & Important Papers', type: V, text: 'Teach the basics: how a mortgage works, how credit works, how to not get taken.' },
  { theme: 'Money & Important Papers', type: A, text: 'If money ever gets tight, what\u2019s the playbook? What gets cut first, what never gets cut?' },

  /* ---------------- Just in case ---------------- */
  { theme: 'Just In Case', type: T, text: 'Write the "first week" letter: the practical things the family should do in the first days if something happens to you.' },
  { theme: 'Just In Case', type: V, text: 'Who should the family call first, second, and third — and for what?' },
  { theme: 'Just In Case', type: T, text: 'Where is the master list? Document where account information and the password manager\u2019s emergency access live (not the passwords themselves).' },
  { theme: 'Just In Case', type: V, text: 'What are your wishes — the conversations that are hard to have out loud? Say them here.' },
  { theme: 'Just In Case', type: A, text: 'What should the family absolutely not do in the first six months of grief? (Big decisions, big purchases…)' },
  { theme: 'Just In Case', type: V, text: 'Explain what should happen with the house, the cars, and anything you feel strongly about.' },
  { theme: 'Just In Case', type: T, text: 'Write down who gets which meaningful objects, and the story of why.' },
  { theme: 'Just In Case', type: V, text: 'Record the message you\u2019d want them to watch on the hardest day. Take your time with this one.' },

  /* ---------------- Us — moments I never want forgotten ---------------- */
  { theme: 'Moments I Never Want Forgotten', type: V, text: 'Tell each kid the story of a moment with them you replay in your head.' },
  { theme: 'Moments I Never Want Forgotten', type: V, text: 'What\u2019s something each kid did that made you laugh until you couldn\u2019t breathe?' },
  { theme: 'Moments I Never Want Forgotten', type: V, text: 'When were you proudest of each of them — not the trophy moments, the character moments?' },
  { theme: 'Moments I Never Want Forgotten', type: A, text: 'What do you see in each kid that they maybe don\u2019t see in themselves yet?' },
  { theme: 'Moments I Never Want Forgotten', type: V, text: 'Tell the story of an ordinary evening at home that you\u2019d give anything to relive.' },
  { theme: 'Moments I Never Want Forgotten', type: V, text: 'What\u2019s a hard parenting moment you got wrong, and what you wish you\u2019d done?' },
  { theme: 'Moments I Never Want Forgotten', type: T, text: 'Write to your wife: the things you\u2019ve maybe never said plainly enough.' },
  { theme: 'Moments I Never Want Forgotten', type: V, text: 'What does this family do better than any family you know?' },
  { theme: 'Moments I Never Want Forgotten', type: A, text: 'Describe each person in the family in three words, and explain each word.' },
  { theme: 'Moments I Never Want Forgotten', type: V, text: 'Say the thing you always mean to say and never quite do. This is the place.' },
].map((p, i) => ({ theme: p.theme, text: p.text, suggested_type: p.type, sort_order: i }));
