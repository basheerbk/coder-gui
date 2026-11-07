add_library(usermod_tbsys INTERFACE)
target_sources(usermod_tbsys INTERFACE ${CMAKE_CURRENT_LIST_DIR}/tbsys.c)
target_include_directories(usermod_tbsys INTERFACE ${CMAKE_CURRENT_LIST_DIR})
target_link_libraries(usermod INTERFACE usermod_tbsys)
