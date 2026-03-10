const TRIP_DATA = {
  hotel: { name: "Citybox Oslo", address: "Prinsens gate 6", lat: 59.91034, lng: 10.74729 },
  flight_in: "DY1303 Gatwick 09:15 → Oslo 12:25 (Wed Mar 11)",
  flight_out: "Saturday March 14, early morning (TBC)",
  weather: "3-4°C, 35% snow chance each day",

  days: [
    {
      id: "day1",
      label: "Day 1",
      date: "Wed Mar 11",
      title: "Arrival, Bjørvika & Arsenal Night",
      narrative: "Land at Gardermoen, Flytoget to Oslo S. Drop bags at Citybox, quick coffee at Hakone, late lunch at The Little Pickle before the 3pm close. Opera House rooftop, then MUNCH — free Wednesday evenings. Bohemen for Arsenal (18:45 Oslo). Fiskeriet post-match, Himkok nightcap.",
      stops: [
        { time: "1:30 PM", name: "Citybox Oslo", type: "hotel", notes: "Drop bags. Self check-in. 3 min walk from Oslo S.", hours: "24hrs", mustVisit: false, rating: 4.0, lat: 59.91034, lng: 10.74729, mapsUrl: "https://maps.google.com/?cid=10770267154924734347" },
        { time: "1:50 PM", name: "Hakone Coffee", type: "coffee", notes: "Coffee #1 (and only today). Pistachio croissant + coffee. 4 min walk from hotel.", hours: "7am–8pm", mustVisit: false, rating: 4.5, lat: 59.91389, lng: 10.75078, mapsUrl: "https://maps.google.com/?cid=6614808648660910634" },
        { time: "2:15 PM", name: "The Little Pickle", type: "food", notes: "Late lunch — sourdough, eggs, small dishes, cinnamon rolls. Closes 3pm — arrive by 2:15 latest.", hours: "9am–3pm, 5–9pm", mustVisit: true, rating: 4.7, lat: 59.91909, lng: 10.76404, mapsUrl: "https://maps.google.com/?cid=10750324768548130019" },
        { time: "3:10 PM", name: "Oslo Opera House", type: "culture", notes: "Quick rooftop walk. 15-20 mins. Panoramic fjord views. Free.", hours: "Always open", mustVisit: false, rating: 4.7, lat: 59.90749, lng: 10.75313, mapsUrl: "https://maps.google.com/?cid=2069025550397265425" },
        { time: "3:30 PM", name: "MUNCH", type: "culture", notes: "FREE admission Wednesday evenings. Open until 9pm. 2 hours before the match — highlights + top floor café views. 13 floors.", hours: "10am–9pm", mustVisit: false, rating: 4.6, lat: 59.9059, lng: 10.75526, mapsUrl: "https://maps.google.com/?cid=7295538454545109531" },
        { time: "6:00 PM", name: "Bohemen Sportspub", type: "drink", notes: "Brighton vs Arsenal. 18:45 Oslo kick-off (17:45 GMT). Get there by 6pm. No food served — can bring own.", hours: "2pm–12am", mustVisit: true, rating: 4.3, lat: 59.91451, lng: 10.74093, mapsUrl: "https://maps.google.com/?cid=6296124625425758021" },
        { time: "9:00 PM", name: "Fiskeriet Bjørvika", type: "food", notes: "Post-match seafood. Fish soup is the move. Open until 10:30pm. 10 min walk from Bohemen.", hours: "11am–10:30pm", mustVisit: false, rating: 4.4, lat: 59.90641, lng: 10.75731, mapsUrl: "https://maps.google.com/?cid=10781361552411786853" },
        { time: "10:00 PM", name: "Himkok", type: "drink", notes: "Post-match cocktails. World's 50 Best Bars. Own distillery. Nordic cocktails.", hours: "5pm–12am", mustVisit: false, rating: 4.6, lat: 59.91429, lng: 10.75153, mapsUrl: "https://maps.google.com/?cid=6679656177791996322" }
      ]
    },
    {
      id: "day2",
      label: "Day 2",
      date: "Thu Mar 12",
      title: "Grünerløkka Food Crawl & St. Hanshaugen",
      narrative: "Sleep in after Arsenal night. Tim Wendelboe coffee pilgrimage, then breakfast at Åpent Bakeri. Graze at Mathallen, Ugly Duckling sandwich for lunch. Long afternoon at the National Museum. Jazzpils at Juret. Korean wings at 175°C K-fried, second coffee at Supreme Roastworks. Big dinner at Little Wolf. Wine at Vinkassen.",
      stops: [
        { time: "10:00 AM", name: "Tim Wendelboe", type: "coffee", notes: "Coffee #1. World's 2nd best coffee shop 2026. Tiny. No real food.", hours: "8:30am–6pm", mustVisit: false, rating: 4.8, lat: 59.92337, lng: 10.7557, mapsUrl: "https://maps.google.com/?cid=3391370463995849095" },
        { time: "10:30 AM", name: "Åpent Bakeri", type: "food", notes: "Proper breakfast. Cardamom buns, sourdough, egg dishes. 10 min walk west from Tim Wendelboe.", hours: "7:30am–5pm", mustVisit: false, rating: 4.5, lat: 59.92328, lng: 10.73634, mapsUrl: "https://maps.google.com/?cid=14058275554024470135" },
        { time: "11:30 AM", name: "Mathallen Oslo", type: "food", notes: "Graze, don't gorge. Vulkanfisk is the standout (fish & chips, shrimp). Spanish tapas stall solid too. Hopyard has 100+ beers.", hours: "10am–8pm", mustVisit: false, rating: 4.4, lat: 59.92223, lng: 10.75205, mapsUrl: "https://maps.google.com/?cid=11936280659795236291" },
        { time: "12:15 PM", name: "Ugly Duckling", type: "food", notes: "Porchetta or duck confit on brioche. Don't skip the chocolate chip cookie.", hours: "11am–7pm", mustVisit: true, rating: 4.7, lat: 59.91634, lng: 10.75232, mapsUrl: "https://maps.google.com/?cid=9613631034661662450" },
        { time: "1:00 PM", name: "National Museum", type: "culture", notes: "Allow 2.5 hours. Munch's The Scream. 6,500+ works. Rooftop terrace. Closes 5pm Thursday.", hours: "10am–5pm", mustVisit: false, rating: 4.6, lat: 59.91151, lng: 10.72925, mapsUrl: "https://maps.google.com/?cid=4855293086132377158" },
        { time: "3:40 PM", name: "Juret at Kunstnernes Hus", type: "drink", notes: "Post-museum jazzpils. Functionalist art building near Royal Palace Park. Cheap beer. 5 min from National Museum.", hours: "11am–11pm", mustVisit: false, rating: 4.3, lat: 59.91953, lng: 10.73074, mapsUrl: "https://maps.google.com/?cid=4581889354591828168" },
        { time: "4:15 PM", name: "175°C K-fried", type: "food", notes: "Korean fried wings. Honey soy is the crowd favourite. kr 200-300.", hours: "3pm–9:30pm", mustVisit: true, rating: 4.6, lat: 59.92252, lng: 10.75191, mapsUrl: "https://maps.google.com/?cid=12620919045443172189" },
        { time: "5:00 PM", name: "Supreme Roastworks", type: "coffee", notes: "Coffee #2. Possibly best coffee in Oslo. Tiny — 4 tables. Colombian beans. Closes 5pm.", hours: "8am–5pm", mustVisit: false, rating: 4.7, lat: 59.92799, lng: 10.75926, mapsUrl: "https://maps.google.com/?cid=4588869305743443205" },
        { time: "6:30 PM", name: "Little Wolf", type: "food", notes: "BIG DINNER. Mediterranean small plates + homemade pasta. Solo dining at the open kitchen. 3-4 dishes.", hours: "4pm–11pm", mustVisit: true, rating: 4.8, lat: 59.93123, lng: 10.74274, mapsUrl: "https://maps.google.com/?cid=814410303222646028" },
        { time: "8:30 PM", name: "Vinkassen", type: "drink", notes: "Post-dinner wine. Two Danes, proper food menu. Walk in. 10 min downhill from Little Wolf.", hours: "4pm–12am", mustVisit: false, rating: 4.9, lat: 59.9284, lng: 10.73254, mapsUrl: "https://maps.google.com/?cid=18098789964172714509" }
      ]
    },
    {
      id: "day3",
      label: "Day 3",
      date: "Fri Mar 13",
      title: "Fortress, Vikings & Tabuno Splurge",
      narrative: "Last full day, lighter evening for early Saturday flight. Coffee at Fuglen, then Akershus Fortress — no rush on the ramparts. Casual pizza lunch at Duken. Historical Museum for VIKINGR (closes 4pm Friday). Straight to Tabuno at 5pm for the big splurge. Himkok nightcap, then early night.",
      stops: [
        { time: "9:00 AM", name: "Fuglen Coffee Roasters", type: "coffee", notes: "Coffee #1 (and only today). Oslo institution. Own roastery. Opens 7am. Beautiful 1963 interiors.", hours: "7am–12am", mustVisit: false, rating: 4.5, lat: 59.90622, lng: 10.77465, mapsUrl: "https://maps.google.com/?cid=2299435593279043043" },
        { time: "9:45 AM", name: "Akershus Fortress", type: "culture", notes: "Medieval castle, 1300s. Free. Walk the ramparts, fjord views, Aker Brygge panorama. No rush. Allow 75 mins.", hours: "6am–9pm", mustVisit: false, rating: 4.6, lat: 59.90759, lng: 10.73708, mapsUrl: "https://maps.google.com/?cid=12261345591794003386" },
        { time: "1:00 PM", name: "Duken Bar&Pizza", type: "food", notes: "Casual pizza lunch. Opens 1pm Fri. Szechuan potato, kebab pizza, Thai pizza. Walk-in.", hours: "1pm–2am", mustVisit: true, rating: 4.5, lat: 59.92541, lng: 10.76088, mapsUrl: "https://maps.google.com/?cid=10102816764727929641" },
        { time: "2:15 PM", name: "Historical Museum", type: "culture", notes: "VIKINGR exhibition — Viking Age artefacts. Closes 4pm Fridays. Allow 1.5 hours. Beautiful Art Nouveau building.", hours: "11am–4pm", mustVisit: false, rating: 4.4, lat: 59.91679, lng: 10.73552, mapsUrl: "https://maps.google.com/?cid=2368397936845482079" },
        { time: "5:00 PM", name: "Tabuno", type: "food", notes: "BIG SPLURGE. Filipino-Norwegian tasting menu. Chef Ivy Tabuno Solheim. 5pm sitting BOOKED. Set menu only.", hours: "5pm–12am", mustVisit: true, rating: 4.8, lat: 59.90672, lng: 10.76011, mapsUrl: "https://maps.google.com/?cid=6992344087933554058" },
        { time: "7:30 PM", name: "Himkok", type: "drink", notes: "Nightcap. Don't go too hard — early flight tomorrow. Open until 2am Fridays.", hours: "5pm–2am", mustVisit: false, rating: 4.6, lat: 59.91429, lng: 10.75153, mapsUrl: "https://maps.google.com/?cid=6679656177791996322" }
      ]
    }
  ],

  maybes: [
    { name: "Vigeland Sculpture Park", type: "culture", notes: "200+ sculptures, free, open 24hrs. Best as early morning add-on — tram from Majorstuen. Allow 60-90 mins.", hours: "24hrs", rating: 4.7, lat: 59.92703, lng: 10.70087, mapsUrl: "https://maps.google.com/?cid=604600159167694742" },
    { name: "Byssa", type: "food", notes: "Seafood splurge, 14 seats, set menu. BOOK AHEAD. Could swap in for a Wed/Thu dinner if something falls through.", hours: "Wed-Sat 5–11pm", rating: 4.9, lat: 59.91126, lng: 10.74333, mapsUrl: "https://maps.google.com/?cid=17024325290700865712" },
    { name: "anam cara", type: "drink", notes: "'Soul friend' cocktail bar. Great mocktails. Bjørvika — near MUNCH and Tabuno. Opens 4pm Wed-Sat.", hours: "Wed 4pm–12am, Fri 4pm–1am", rating: 4.7, lat: 59.90644, lng: 10.76008, mapsUrl: "https://maps.google.com/?cid=10614281168753743902" },
    { name: "Izakaya by Vladimir Pak", type: "food", notes: "Japanese small plates, sake, cosy basement. Walk-ins only. Central — good spontaneous late-night option.", hours: "Wed-Sat 4–10pm", rating: 4.5, lat: 59.90904, lng: 10.74233, mapsUrl: "https://maps.google.com/?cid=7086633705601738919" },
    { name: "Kork", type: "food", notes: "Ex-Lofthus pizza chef, thin crust, truffle salami. Markveien, Grünerløkka — you'll walk past it on Day 2.", hours: "Wed-Fri 3–11pm", rating: 4.9, lat: 59.92188, lng: 10.75751, mapsUrl: "https://maps.google.com/?cid=12463735566765250299" },
    { name: "Pasta Fresca", type: "food", notes: "Fresh pasta, 3 winter seats. Carbonara, wild boar ravioli. Impulse stop on Day 2 in Grünerløkka.", hours: "Mon-Fri 11am–6pm", rating: 4.7, lat: 59.91985, lng: 10.7601, mapsUrl: "https://maps.google.com/?cid=11597098862854398735" },
    { name: "SKAAL Matbar", type: "food", notes: "Famous cheddar jalapeño toast, oysters, natural wine. Grünerløkka. Strong Day 2 swap-in.", hours: "Wed-Thu 12–11:30pm, Fri 12pm–12am", rating: 4.4, lat: 59.92349, lng: 10.75863, mapsUrl: "https://maps.google.com/?cid=9125103536139699006" },
    { name: "Smalhans", type: "food", notes: "Bib Gourmand, Norwegian ingredients, set menus. St. Hanshaugen — backup if Little Wolf doesn't work out.", hours: "Wed-Fri 1–11pm", rating: 4.2, lat: 59.92371, lng: 10.73971, mapsUrl: "https://maps.google.com/?cid=11239887004663536204" },
    { name: "Grotto", type: "food", notes: "French bistro, ex-garage. Oysters, halibut, monkfish. Wildcard dinner swap. Near St. Hanshaugen.", hours: "Wed-Fri 5–11:30pm", rating: 4.3, lat: 59.9221, lng: 10.73902, mapsUrl: "https://maps.google.com/?cid=2834850080372284829" }
  ],

  checklist: [
    { text: "Book Tabuno — Friday 5pm sitting", done: false },
    { text: "Book Byssa if swapping in", done: false },
    { text: "Confirm Saturday flight time", done: false },
    { text: "Download Voi or Tier app for e-scooters", done: false }
  ],

  budget: {
    "Casual meal": "kr 200-400",
    "Splurge dinner": "kr 1,000+",
    "Beer at pub": "kr 90-120",
    "Wine by glass": "kr 130-180",
    "Coffee": "kr 60-80"
  }
};
