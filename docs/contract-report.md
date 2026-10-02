# Contract report

Run 2026-10-02T19:08:40.204Z against live SerpApi.

  - queries: Diwali sweet recipe jaggery crispy outside soft inside sesame coated deep fried | traditional Indian sweet recipe jaggery crispy outside soft inside sesame coated round
- ✅ **Gate A: Anarsa family in top 3 for the Nani memory** `["Fried Modak []","Shankarpali []","Adhirasam []"]`
  - knowledge_graph docs: 0 · recipe docs: 8 · total docs: 30
- ✅ **google.organic_results[].{title,link,snippet}** `"https://en.wikipedia.org/wiki/Rice"`
- ✅ **google.recipes_results (optional)** `{"title":"Adhirasam recipe","link":"https://rakskitchen.net/adhirasam-recipe-deepavali-recipes/","source":"Raks Kitchen","rating":5,"reviews":23,"total_time":"33m","total_ingredients_original":"7 ingredients","total_ingredients":7,"thumbnail":"https://serpapi.com/searches/6ac000a9ec900dc84e56c583/im`
- ✅ **google.related_questions (optional)** `"What is Chinese sweet rice flour?"`
- ✅ **google_images.images_results[].thumbnail** 
- ✅ **trends GEO_MAP compared_breakdown_by_region (geo=IN, region=REGION)** `[{"geo":"IN-TN","location":"Tamil Nadu","max_value_index":1,"values":[{"query":"anarsa","value":"2%","extracted_value":2},{"query":"adhirasam","value":"94%","extracted_value":94},{"query":"ariselu","value":"4%","extracted_value":4}]},{"geo":"IN-PY","location":"Puducherry","max_value_index":1,"values`
  - state geo codes: IN-TN:Tamil Nadu, IN-PY:Puducherry, IN-BR:Bihar, IN-JH:Jharkhand, IN-AP:Andhra Pradesh, IN-TG:Telangana, IN-CT:Chhattisgarh, IN-MH:Maharashtra, IN-KA:Karnataka, IN-DL:Delhi, IN-UP:Uttar Pradesh, IN-MP:Madhya Pradesh, IN-HR:Haryana, IN-UT:Uttarakhand, IN-GA:Goa, IN-WB:West Bengal, IN-CH:Chandigarh, IN-GJ:Gujarat, IN-MN:Manipur, IN-KL:Kerala, IN-OR:Odisha, IN-PB:Punjab, IN-HP:Himachal Pradesh, IN-RJ:Rajasthan, IN-AS:Assam, IN-JK:Jammu and Kashmir
- ✅ **trends TIMESERIES timeline_data[].{timestamp,values[].extracted_value}** `{"date":"Jan 2004","timestamp":"1072915200","values":[{"query":"anarsa","query_index":0,"value":"0","extracted_value":0}]}`
- ✅ **youtube.video_results[].{title,link,channel}** `{"title":"Anarsa Easy Recipe | अनरसे की परफेक्ट रेसिपी | perfect Anarasa at home | Chef Ranveer Brar","channel":"Chef Ranveer Brar"}`
  - youtube video fields: position_on_page, title, link, serpapi_link, video_id, channel, published_date, views, length, description, extensions, thumbnail
- ✅ **youtube_video_transcript.transcript[].{start_ms,snippet}** `{"start_ms":501,"end_ms":3264,"snippet":" Welcome, I am Ranveer Brar!","start_time_text":"0:00","start_time_label":"0:00"}`
  - transcript keys: search_metadata, search_parameters, transcript, available_transcripts · first: {"start_ms":501,"end_ms":3264,"snippet":" Welcome, I am Ranveer Brar!","start_time_text":"0:00","start_time_label":"0:00"}
- ✅ **google_maps.local_results[].{title,data_id,gps_coordinates}** `{"title":"Agrawal Sweets","rating":4.1}`
- ✅ **google_maps_reviews (reviews[] optional: absent when no review mentions the dish)** `"no matching reviews"`
