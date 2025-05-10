from satellitor_backend.yolov11_model import get_mask, get_Percentage, detect_edges, get_best_crops, get_crops, \
    get_fragmentation
import cv2
# img=get_mask("./inputs/img.png","./")
# cv2.imwrite(img,"./")
# print(get_fragmentation(img_mask=img))
# print(get_Percentage(img,True))
# edge=detect_edges(img,"./")
# cv2.imwrite("poundries.jpg",edge)
# cv2.imwrite("mask2.jpg",img)
# get_land_properities(31.50517021697184, 31.894339612466112)
# result = get_best_crops(8,35,100)
# for crop in result:
#     print(f"{crop['crop_name']}")
#     print(f"  - Temp Suitable: {crop['isTemp']}")
#     print(f"  - pH Suitable: {crop['isPh']}")
#     print(f"  - Rainfall Suitable: {crop['isRainfall']}")
#     if crop['crop_notes']:
#         print(f"  - Notes: {crop['crop_notes']}")
#     print(f"  - Data: {crop['crop_data']}")
#
# print(len(result))
#
#
# result = get_crops(8,35,100)
# for crop in result:
#     print(f"{crop['crop_name']}")
#     print(f"  - Temp Suitable: {crop['isTemp']}")
#     print(f"  - pH Suitable: {crop['isPh']}")
#     print(f"  - Rainfall Suitable: {crop['isRainfall']}")
#     if crop['crop_notes']:
#         print(f"  - Notes: {crop['crop_notes']}")
#     print(f"  - Data: {crop['crop_data']}")
#
# print(len(result))
