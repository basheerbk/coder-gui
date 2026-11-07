add_library(usermod_tbcloud INTERFACE)
target_sources(usermod_tbcloud INTERFACE ${CMAKE_CURRENT_LIST_DIR}/tbcloud.c)
target_include_directories(usermod_tbcloud INTERFACE ${CMAKE_CURRENT_LIST_DIR})

# esp-mqtt is the ESP-IDF "mqtt" component (built in to IDF v5.2). The port builds and links every
# IDF component, but its main component does not require mqtt, so only the headers are missing.
# Plain paths only: MicroPython's usermod scan cannot read the generator expressions that linking
# idf::mqtt would pull in. esp_wifi, esp_timer, esp_event, esp_netif and nvs_flash are already
# required by the port.
foreach(tb_comp mqtt tcp_transport esp-tls)
    idf_component_get_property(tb_comp_dir ${tb_comp} COMPONENT_DIR)
    idf_component_get_property(tb_comp_incs ${tb_comp} INCLUDE_DIRS)
    foreach(tb_inc ${tb_comp_incs})
        if(NOT IS_ABSOLUTE ${tb_inc})
            set(tb_inc ${tb_comp_dir}/${tb_inc})
        endif()
        target_include_directories(usermod_tbcloud INTERFACE ${tb_inc})
    endforeach()
endforeach()

target_link_libraries(usermod INTERFACE usermod_tbcloud)
